-- Helper functions and triggers that enforce business rules at the database layer.

-- ---------------------------------------------------------------- authorization helpers
-- SECURITY DEFINER avoids recursive RLS evaluation on user_roles. search_path is
-- empty so a caller cannot shadow referenced objects.
create function public.has_role(_role public.app_role) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = _role
  );
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.has_role('admin');
$$;

create function public.is_lister() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role in ('owner', 'agent', 'admin')
  );
$$;

create function public.is_conversation_participant(_conversation_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = _conversation_id and user_id = (select auth.uid())
  );
$$;

create function public.owns_listing(_listing_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings
    where id = _listing_id and owner_id = (select auth.uid())
  );
$$;

create function public.listing_is_public(_listing_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings where id = _listing_id and status = 'published'
  );
$$;

create function public.unit_is_public(_unit_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.listings where unit_id = _unit_id and status = 'published'
  );
$$;

create function public.property_is_public(_property_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.property_units u
    join public.listings l on l.unit_id = u.id
    where u.property_id = _property_id and l.status = 'published'
  );
$$;

create function public.is_blocked_between(_a uuid, _b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = _a and blocked_id = _b) or (blocker_id = _b and blocked_id = _a)
  );
$$;

-- ---------------------------------------------------------------- new user bootstrap
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1),
      'ผู้ใช้'
    )
  );
  -- Role is always 'member' here. Metadata is client-controlled and must never set a role.
  insert into public.user_roles (user_id, role) values (new.id, 'member');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- profile protection
create function public.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.email is distinct from old.email
    or new.status is distinct from old.status
    or new.status_reason is distinct from old.status_reason
    or new.verified_at is distinct from old.verified_at
    or new.deactivated_at is distinct from old.deactivated_at
  ) then
    raise exception 'profile moderation fields are read-only' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.guard_profile_update();

-- ---------------------------------------------------------------- listing state machine
-- Keep in sync with LISTING_TRANSITIONS in packages/shared. A test compares the two.
create table public.listing_transitions (
  from_status public.listing_status not null,
  to_status public.listing_status not null,
  actor text not null check (actor in ('owner', 'system')),
  primary key (from_status, to_status)
);

insert into public.listing_transitions (from_status, to_status, actor) values
  ('draft', 'pending_review', 'owner'),
  ('draft', 'archived', 'owner'),
  ('pending_review', 'draft', 'owner'),
  ('pending_review', 'archived', 'owner'),
  ('pending_review', 'published', 'system'),
  ('pending_review', 'rejected', 'system'),
  ('rejected', 'draft', 'owner'),
  ('rejected', 'pending_review', 'owner'),
  ('rejected', 'archived', 'owner'),
  ('published', 'pending_review', 'owner'),
  ('published', 'paused', 'owner'),
  ('published', 'rented', 'owner'),
  ('published', 'sold', 'owner'),
  ('published', 'archived', 'owner'),
  ('published', 'expired', 'system'),
  ('published', 'rejected', 'system'),
  ('paused', 'published', 'owner'),
  ('paused', 'pending_review', 'owner'),
  ('paused', 'archived', 'owner'),
  ('paused', 'rejected', 'system'),
  ('rented', 'archived', 'owner'),
  ('sold', 'archived', 'owner'),
  ('expired', 'pending_review', 'owner'),
  ('expired', 'archived', 'owner');

create function public.guard_listing_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  _is_client boolean := current_user in ('anon', 'authenticated');
  _actor text;
begin
  if tg_op = 'INSERT' then
    if _is_client and new.status <> 'draft' then
      raise exception 'new listings must start as draft' using errcode = '42501';
    end if;
    return new;
  end if;

  if _is_client and (
    new.owner_id is distinct from old.owner_id
    or new.unit_id is distinct from old.unit_id
    or new.published_at is distinct from old.published_at
    or new.expires_at is distinct from old.expires_at
    or new.reviewed_by is distinct from old.reviewed_by
    or new.reviewed_at is distinct from old.reviewed_at
    or new.rejected_reason is distinct from old.rejected_reason
  ) then
    raise exception 'listing moderation fields are read-only' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    select actor into _actor from public.listing_transitions
    where from_status = old.status and to_status = new.status;

    if _actor is null then
      raise exception 'invalid listing transition: % -> %', old.status, new.status
        using errcode = '23514';
    end if;
    if _is_client and _actor <> 'owner' then
      raise exception 'transition % -> % requires moderation', old.status, new.status
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger listings_guard before insert or update on public.listings
  for each row execute function public.guard_listing_write();

create function public.log_listing_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.listing_status_history (listing_id, from_status, to_status, actor_id)
    values (
      new.id,
      case when tg_op = 'UPDATE' then old.status end,
      new.status,
      (select auth.uid())
    );
  end if;
  return null;
end $$;

create trigger listings_status_history after insert or update of status on public.listings
  for each row execute function public.log_listing_status();

-- ---------------------------------------------------------------- search text
create function public.build_listing_search_text(_title text, _description text, _unit_id uuid)
returns text
language sql stable security definer set search_path = '' as $$
  select lower(concat_ws(' ',
    _title, _description,
    p.name_th, p.name_en, parent.name_th, parent.name_en, p.address,
    province.name_th, province.name_en, district.name_th, district.name_en,
    subdistrict.name_th, subdistrict.name_en
  ))
  from public.property_units u
  join public.properties p on p.id = u.property_id
  left join public.properties parent on parent.id = p.parent_id
  join public.locations province on province.id = p.province_id
  join public.locations district on district.id = p.district_id
  left join public.locations subdistrict on subdistrict.id = p.subdistrict_id
  where u.id = _unit_id;
$$;

create function public.refresh_listing_search_text() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.search_text := coalesce(
    public.build_listing_search_text(new.title, new.description, new.unit_id),
    lower(new.title || ' ' || new.description)
  );
  return new;
end $$;

create trigger listings_search_text before insert or update of title, description, unit_id on public.listings
  for each row execute function public.refresh_listing_search_text();

create function public.propagate_property_search_text() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.listings l
  set search_text = public.build_listing_search_text(l.title, l.description, l.unit_id)
  from public.property_units u
  where l.unit_id = u.id
    and (u.property_id = new.id
      or u.property_id in (select id from public.properties where parent_id = new.id));
  return null;
end $$;

create trigger properties_search_text after update of name_th, name_en, address, province_id, district_id, subdistrict_id
  on public.properties
  for each row execute function public.propagate_property_search_text();

-- ---------------------------------------------------------------- appointments
create function public.guard_appointment_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') and (
    new.listing_id is distinct from old.listing_id
    or new.requester_id is distinct from old.requester_id
    or new.owner_id is distinct from old.owner_id
  ) then
    raise exception 'appointment parties are immutable' using errcode = '42501';
  end if;
  return new;
end $$;

create trigger appointments_guard before update on public.appointments
  for each row execute function public.guard_appointment_update();

create function public.log_appointment_event() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status
     or new.scheduled_at is distinct from old.scheduled_at then
    insert into public.appointment_events (appointment_id, actor_id, status, scheduled_at)
    values (new.id, (select auth.uid()), new.status, new.scheduled_at);
  end if;
  return null;
end $$;

create trigger appointments_history after insert or update on public.appointments
  for each row execute function public.log_appointment_event();

-- ---------------------------------------------------------------- messages
create function public.touch_conversation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return null;
end $$;

create trigger messages_touch_conversation after insert on public.messages
  for each row execute function public.touch_conversation();

-- ---------------------------------------------------------------- audit log is append-only
create function public.forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.forbid_mutation();

-- ---------------------------------------------------------------- stats
create function public.record_listing_view(_listing_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.listing_is_public(_listing_id) then
    insert into public.listing_daily_stats (listing_id, day, views)
    values (_listing_id, current_date, 1)
    on conflict (listing_id, day) do update set views = public.listing_daily_stats.views + 1;
  end if;
end $$;

-- ---------------------------------------------------------------- rate limiting
-- Fixed-window counter. Returns true when the request is within the limit.
create function public.rate_limit_hit(_key text, _max integer, _window_seconds integer) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  _window timestamptz := to_timestamp(floor(extract(epoch from now()) / _window_seconds) * _window_seconds);
  _hits integer;
begin
  insert into public.rate_limits (key, window_start) values (_key, _window)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into _hits;
  return _hits <= _max;
end $$;

-- ---------------------------------------------------------------- scheduled maintenance
create function public.expire_listings() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  _count integer;
begin
  update public.listings set status = 'expired'
  where status = 'published' and expires_at is not null and expires_at < now();
  get diagnostics _count = row_count;

  delete from public.rate_limits where window_start < now() - interval '1 day';
  return _count;
end $$;

-- Public-safe projection of a profile. Phone, LINE and status never leave through this view.
create view public.public_profiles as
  select id, display_name, avatar_path, verified_at is not null as is_verified, created_at
  from public.profiles
  where status = 'active';

-- The app reads email from profiles, so it never depends on grants to the auth schema.
create function public.sync_profile_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return null;
end $$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function public.sync_profile_email();
