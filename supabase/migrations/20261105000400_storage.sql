-- Storage buckets. No policies are added to storage.objects on purpose: RLS stays
-- enabled there, so clients cannot write at all. The API validates and re-encodes
-- every file and uploads with the service role. Private documents are only ever
-- reachable through short-lived signed URLs issued after an authorization check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/webp']),
  ('listing-media', 'listing-media', true, 4194304, array['image/webp']),
  ('verification-docs', 'verification-docs', false, 5242880, array['image/webp', 'application/pdf'])
on conflict (id) do nothing;
