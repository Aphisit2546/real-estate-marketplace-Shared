-- Row Level Security. Every table in public has RLS enabled. A table without a policy
-- for a role is denied by default, which is the intended behaviour for anything
-- that only the trusted backend may write.

do $$
declare
  _table text;
begin
  for _table in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', _table);
  end loop;
end $$;

-- ---------------------------------------------------------------- privileges
-- Functions default to EXECUTE for PUBLIC, so lock those down first.
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.expire_listings() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.expire_listings() to service_role;

revoke all on public.rate_limits from anon, authenticated;
revoke all on public.audit_logs from anon;
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke insert, update, delete, truncate on public.listing_status_history from anon, authenticated;
revoke insert, update, delete, truncate on public.appointment_events from anon, authenticated;
revoke insert, update, delete, truncate on public.listing_transitions from anon, authenticated;
revoke insert, update, delete, truncate on public.user_roles from anon, authenticated;

grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------- profiles
create policy profiles_select_self_or_admin on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------- user_roles (read-only for clients)
create policy user_roles_select_self_or_admin on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------- reference data
create policy categories_select_all on public.categories for select to anon, authenticated using (true);
create policy amenities_select_all on public.amenities for select to anon, authenticated using (true);
create policy locations_select_all on public.locations for select to anon, authenticated using (true);
create policy listing_transitions_select_all on public.listing_transitions for select to anon, authenticated using (true);
create policy settings_select_public on public.application_settings for select to anon, authenticated
  using (is_public or (select public.is_admin()));

-- ---------------------------------------------------------------- properties
-- Named projects are shared reference data. Standalone records hold an address and
-- stay private until a listing on them is published.
create policy properties_select on public.properties for select to anon, authenticated
  using (
    kind <> 'standalone'
    or created_by = (select auth.uid())
    or public.property_is_public(id)
    or (select public.is_admin())
  );
create policy properties_insert_lister on public.properties for insert to authenticated
  with check (created_by = (select auth.uid()) and (select public.is_lister()));
create policy properties_update_creator on public.properties for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy property_amenities_select on public.property_amenities for select to anon, authenticated using (true);
create policy property_amenities_write_creator on public.property_amenities for all to authenticated
  using (exists (select 1 from public.properties p where p.id = property_id and p.created_by = (select auth.uid())))
  with check (exists (select 1 from public.properties p where p.id = property_id and p.created_by = (select auth.uid())));

-- ---------------------------------------------------------------- units
create policy units_select on public.property_units for select to anon, authenticated
  using (
    owner_id = (select auth.uid())
    or public.unit_is_public(id)
    or (select public.is_admin())
  );
create policy units_insert_lister on public.property_units for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_lister()));
create policy units_update_owner on public.property_units for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------- listings
create policy listings_select on public.listings for select to anon, authenticated
  using (
    status = 'published'
    or owner_id = (select auth.uid())
    or (select public.is_admin())
  );
create policy listings_insert_lister on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select public.is_lister()));
create policy listings_update_owner on public.listings for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy listing_images_select on public.listing_images for select to anon, authenticated
  using (
    public.listing_is_public(listing_id)
    or public.owns_listing(listing_id)
    or (select public.is_admin())
  );
create policy listing_images_write_owner on public.listing_images for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

create policy listing_amenities_select on public.listing_amenities for select to anon, authenticated
  using (
    public.listing_is_public(listing_id)
    or public.owns_listing(listing_id)
    or (select public.is_admin())
  );
create policy listing_amenities_write_owner on public.listing_amenities for all to authenticated
  using (public.owns_listing(listing_id)) with check (public.owns_listing(listing_id));

create policy listing_history_select on public.listing_status_history for select to authenticated
  using (public.owns_listing(listing_id) or (select public.is_admin()));
create policy listing_stats_select on public.listing_daily_stats for select to authenticated
  using (public.owns_listing(listing_id) or (select public.is_admin()));

-- ---------------------------------------------------------------- personal data
create policy favorites_own on public.favorites for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy saved_searches_own on public.saved_searches for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy search_history_own on public.search_history for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_blocks_own on public.user_blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create policy push_tokens_own on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- messaging
-- Conversations are created by the backend, which checks listing state and blocks first.
create policy conversations_select_participant on public.conversations for select to authenticated
  using (public.is_conversation_participant(id));
create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy participants_update_own on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy messages_select_participant on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));
create policy messages_insert_participant on public.messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
    and kind <> 'system'
    and not exists (
      select 1 from public.conversation_participants other
      where other.conversation_id = messages.conversation_id
        and other.user_id <> (select auth.uid())
        and public.is_blocked_between((select auth.uid()), other.user_id)
    )
  );

-- ---------------------------------------------------------------- appointments
create policy appointments_select_party on public.appointments for select to authenticated
  using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()));
create policy appointments_insert_requester on public.appointments for insert to authenticated
  with check (requester_id = (select auth.uid()) and status = 'requested');
create policy appointments_update_party on public.appointments for update to authenticated
  using (requester_id = (select auth.uid()) or owner_id = (select auth.uid()))
  with check (requester_id = (select auth.uid()) or owner_id = (select auth.uid()));
create policy appointment_events_select_party on public.appointment_events for select to authenticated
  using (exists (
    select 1 from public.appointments a
    where a.id = appointment_id
      and (a.requester_id = (select auth.uid()) or a.owner_id = (select auth.uid()))
  ));

-- ---------------------------------------------------------------- trust & safety
create policy reports_select_own_or_admin on public.listing_reports for select to authenticated
  using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy reports_insert_own on public.listing_reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and status = 'open' and resolved_by is null);

create policy verification_select_own_or_admin on public.verification_requests for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy verification_insert_own on public.verification_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending' and reviewed_by is null);

-- ---------------------------------------------------------------- notifications & audit
create policy notifications_select_own on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notifications_update_own on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy audit_logs_select_admin on public.audit_logs for select to authenticated
  using ((select public.is_admin()));
