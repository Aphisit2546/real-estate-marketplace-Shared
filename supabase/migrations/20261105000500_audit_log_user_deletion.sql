-- The append-only guard also blocked the foreign key's ON DELETE SET NULL, so a user
-- with any audit entry could not be deleted. That one change is now allowed: the
-- entry survives and only loses its link to the deleted account.

create function public.protect_audit_log() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE'
     and old.actor_id is not null
     and new.actor_id is null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'audit_logs is append-only' using errcode = '42501';
end $$;

drop trigger audit_logs_append_only on public.audit_logs;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.protect_audit_log();

revoke execute on function public.protect_audit_log() from public, anon, authenticated;
