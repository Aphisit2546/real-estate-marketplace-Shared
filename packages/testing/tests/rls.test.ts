import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { asRole, startTestDatabase, type TestDatabase } from '../src';

let db: TestDatabase;
let alice: string; // lister
let bob: string; // lister
let carol: string; // member only
let admin: string;
let provinceId: number;
let districtId: number;
let categoryId: number;
let publishedListing: string;
let draftListing: string;
let conversation: string;

const DESCRIPTION = 'ห้องสวย ใกล้รถไฟฟ้า เดินทางสะดวก พร้อมเข้าอยู่ทันที';

async function createUser(email: string, roles: string[] = []): Promise<string> {
  const rows = await db.sql`
    insert into auth.users (email, raw_user_meta_data)
    values (${email}, ${db.sql.json({ display_name: email.split('@')[0] ?? 'x' })})
    returning id`;
  const id = rows[0]!.id as string;
  for (const role of roles) {
    await db.sql`insert into public.user_roles (user_id, role) values (${id}, ${role}::public.app_role)`;
  }
  return id;
}

async function createListing(owner: string, title: string, status: string): Promise<string> {
  const [property] = await db.sql`
    insert into public.properties (kind, name_th, address, province_id, district_id, created_by)
    values ('standalone', 'บ้านส่วนตัว', '1 ถนนทดสอบ', ${provinceId}, ${districtId}, ${owner}) returning id`;
  const [unit] = await db.sql`
    insert into public.property_units (property_id, owner_id, area_sqm)
    values (${property!.id}, ${owner}, 35) returning id`;
  const [listing] = await db.sql`
    insert into public.listings (unit_id, owner_id, category_id, purpose, status, title, description, monthly_rent, contact_name)
    values (${unit!.id}, ${owner}, ${categoryId}, 'rent', ${status}::public.listing_status, ${title}, ${DESCRIPTION}, 12000, 'ผู้ประกาศ')
    returning id`;
  return listing!.id as string;
}

beforeAll(async () => {
  db = await startTestDatabase();
  const [province] = await db.sql`select id from public.locations where code = '10'`;
  const [district] = await db.sql`select id from public.locations where code = '1039'`;
  const [category] = await db.sql`select id from public.categories where slug = 'condo'`;
  provinceId = province!.id as number;
  districtId = district!.id as number;
  categoryId = category!.id as number;

  alice = await createUser('alice@example.com', ['owner']);
  bob = await createUser('bob@example.com', ['owner']);
  carol = await createUser('carol@example.com');
  admin = await createUser('admin@example.com', ['admin']);

  publishedListing = await createListing(alice, 'คอนโดเผยแพร่แล้ว อโศก', 'published');
  draftListing = await createListing(alice, 'คอนโดฉบับร่าง อโศก', 'draft');

  const [conv] = await db.sql`
    insert into public.conversations (listing_id, initiator_id, owner_id)
    values (${publishedListing}, ${carol}, ${alice}) returning id`;
  conversation = conv!.id as string;
  await db.sql`insert into public.conversation_participants (conversation_id, user_id)
    values (${conversation}, ${carol}), (${conversation}, ${alice})`;
  await db.sql`insert into public.messages (conversation_id, sender_id, body)
    values (${conversation}, ${carol}, 'สนใจห้องนี้ครับ')`;
}, 120_000);

afterAll(async () => {
  await db?.stop();
});

describe('schema hygiene', () => {
  it('enables RLS on every public table', async () => {
    const rows = await db.sql`
      select c.relname from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((row) => row.relname)).toEqual([]);
  });

  it('pins search_path on every SECURITY DEFINER function', async () => {
    const rows = await db.sql`
      select p.proname from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef
        and not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')`;
    expect(rows).toEqual([]);
  });

  it('indexes every foreign key', async () => {
    const rows = await db.sql`
      select c.conrelid::regclass::text as tbl, c.conname
      from pg_constraint c
      join pg_namespace n on n.oid = (select relnamespace from pg_class where oid = c.conrelid)
      where c.contype = 'f' and n.nspname = 'public'
        and not exists (
          select 1 from pg_index i
          where i.indrelid = c.conrelid
            and (i.indkey::int2[])[0:cardinality(c.conkey) - 1] @> c.conkey
            and c.conkey @> (i.indkey::int2[])[0:cardinality(c.conkey) - 1]
        )`;
    expect(rows.map((row) => `${row.tbl}.${row.conname}`)).toEqual([]);
  });
});

describe('profiles and roles', () => {
  it('creates a profile and member role for each new auth user', async () => {
    const [role] = await db.sql`select role from public.user_roles where user_id = ${carol}`;
    expect(role?.role).toBe('member');
    const [profile] = await db.sql`select display_name from public.profiles where id = ${carol}`;
    expect(profile?.display_name).toBe('carol');
  });

  it('ignores a role smuggled through signup metadata', async () => {
    const [user] = await db.sql`
      insert into auth.users (email, raw_user_meta_data)
      values ('sneaky@example.com', ${db.sql.json({ role: 'admin' })}) returning id`;
    const roles = await db.sql`select role from public.user_roles where user_id = ${user!.id}`;
    expect(roles.map((row) => row.role)).toEqual(['member']);
  });

  it('lets a user read their own profile but not another', async () => {
    const rows = await asRole(db.sql, 'authenticated', carol, (tx) => tx`select id from public.profiles`);
    expect(rows.map((row) => row.id)).toEqual([carol]);
  });

  it('lets an admin read all profiles', async () => {
    const rows = await asRole(db.sql, 'authenticated', admin, (tx) => tx`select id from public.profiles`);
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  it('hides profiles from anon but exposes the safe view without phone', async () => {
    const rows = await asRole(db.sql, 'anon', null, (tx) => tx`select id from public.profiles`);
    expect(rows).toEqual([]);
    const [view] = await asRole(db.sql, 'anon', null, (tx) => tx`select * from public.public_profiles limit 1`);
    expect(Object.keys(view!)).not.toContain('phone');
  });

  it('allows editing your own display name', async () => {
    const rows = await asRole(db.sql, 'authenticated', carol, (tx) =>
      tx`update public.profiles set bio = 'สวัสดี' where id = ${carol} returning id`);
    expect(rows).toHaveLength(1);
  });

  it('silently affects no rows when editing someone else', async () => {
    const rows = await asRole(db.sql, 'authenticated', carol, (tx) =>
      tx`update public.profiles set bio = 'hacked' where id = ${alice} returning id`);
    expect(rows).toHaveLength(0);
  });

  it('blocks a user from marking themselves verified', async () => {
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`update public.profiles set verified_at = now() where id = ${carol}`),
    ).rejects.toThrow(/read-only/);
  });

  it('blocks self-promotion to admin', async () => {
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`insert into public.user_roles (user_id, role) values (${carol}, 'admin')`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`update public.user_roles set role = 'admin' where user_id = ${carol}`),
    ).rejects.toThrow(/permission denied/);
  });
});

describe('listings', () => {
  it('shows only published listings to anon', async () => {
    const rows = await asRole(db.sql, 'anon', null, (tx) => tx`select id from public.listings`);
    const ids = rows.map((row) => row.id);
    expect(ids).toContain(publishedListing);
    expect(ids).not.toContain(draftListing);
  });

  it('shows drafts to their owner only', async () => {
    const own = await asRole(db.sql, 'authenticated', alice, (tx) =>
      tx`select id from public.listings where id = ${draftListing}`);
    expect(own).toHaveLength(1);
    const other = await asRole(db.sql, 'authenticated', bob, (tx) =>
      tx`select id from public.listings where id = ${draftListing}`);
    expect(other).toHaveLength(0);
  });

  it('prevents one owner editing another owner\'s listing', async () => {
    const rows = await asRole(db.sql, 'authenticated', bob, (tx) =>
      tx`update public.listings set title = 'ถูกแก้โดยคนอื่น' where id = ${publishedListing} returning id`);
    expect(rows).toHaveLength(0);
  });

  it('prevents a plain member creating a listing', async () => {
    const [unit] = await db.sql`select id from public.property_units limit 1`;
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) => tx`
        insert into public.listings (unit_id, owner_id, category_id, purpose, title, description, monthly_rent, contact_name)
        values (${unit!.id}, ${carol}, ${categoryId}, 'rent', 'ประกาศของสมาชิก', ${DESCRIPTION}, 10000, 'x')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('prevents an owner publishing their own draft', async () => {
    const id = await createListing(alice, 'พยายามข้ามการตรวจสอบ', 'pending_review');
    await expect(
      asRole(db.sql, 'authenticated', alice, (tx) =>
        tx`update public.listings set status = 'published' where id = ${id}`),
    ).rejects.toThrow(/requires moderation/);
  });

  it('prevents creating a listing already published', async () => {
    const [unit] = await db.sql`select id from public.property_units where owner_id = ${alice} limit 1`;
    await expect(
      asRole(db.sql, 'authenticated', alice, (tx) => tx`
        insert into public.listings (unit_id, owner_id, category_id, purpose, status, title, description, monthly_rent, contact_name)
        values (${unit!.id}, ${alice}, ${categoryId}, 'rent', 'published', 'เผยแพร่ตรง', ${DESCRIPTION}, 10000, 'x')`),
    ).rejects.toThrow(/start as draft/);
  });

  it('prevents an owner forging moderation fields', async () => {
    await expect(
      asRole(db.sql, 'authenticated', alice, (tx) =>
        tx`update public.listings set reviewed_by = ${alice} where id = ${draftListing}`),
    ).rejects.toThrow(/read-only/);
  });

  it('rejects an invalid transition for every role', async () => {
    await expect(
      asRole(db.sql, 'service_role', null, (tx) =>
        tx`update public.listings set status = 'sold' where id = ${draftListing}`),
    ).rejects.toThrow(/invalid listing transition/);
  });

  it('records status history with the acting user', async () => {
    const id = await createListing(alice, 'ทดสอบประวัติสถานะ', 'draft');
    await asRole(db.sql, 'authenticated', alice, (tx) =>
      tx`update public.listings set status = 'pending_review' where id = ${id}`);
    const rows = await db.sql`
      select from_status, to_status, actor_id from public.listing_status_history
      where listing_id = ${id} order by id`;
    expect(rows.at(-1)).toMatchObject({ from_status: 'draft', to_status: 'pending_review', actor_id: alice });
  });

  it('enforces sale and rent pricing separation', async () => {
    const [unit] = await db.sql`select id from public.property_units limit 1`;
    await expect(db.sql`
      insert into public.listings (unit_id, owner_id, category_id, purpose, title, description, monthly_rent, contact_name)
      values (${unit!.id}, ${alice}, ${categoryId}, 'sale', 'ขายแต่ใส่ค่าเช่า', ${DESCRIPTION}, 10000, 'x')`,
    ).rejects.toThrow(/listings_price_matches_purpose/);
  });

  it('rejects negative prices and coordinates outside Thailand', async () => {
    const [unit] = await db.sql`select id from public.property_units limit 1`;
    await expect(db.sql`
      insert into public.listings (unit_id, owner_id, category_id, purpose, title, description, monthly_rent, contact_name)
      values (${unit!.id}, ${alice}, ${categoryId}, 'rent', 'ราคาติดลบ', ${DESCRIPTION}, -1, 'x')`,
    ).rejects.toThrow(/check/);
    await expect(db.sql`
      insert into public.properties (kind, name_th, address, province_id, district_id, created_by, lat, lng)
      values ('standalone', 'นอกประเทศ', 'x', ${provinceId}, ${districtId}, ${alice}, 51.5, -0.12)`,
    ).rejects.toThrow(/check/);
  });

  it('blocks a duplicate live listing on the same unit', async () => {
    const [unit] = await db.sql`select unit_id from public.listings where id = ${publishedListing}`;
    await expect(db.sql`
      insert into public.listings (unit_id, owner_id, category_id, purpose, status, title, description, monthly_rent, contact_name)
      values (${unit!.unit_id}, ${alice}, ${categoryId}, 'rent', 'pending_review', 'ประกาศซ้ำห้องเดิม', ${DESCRIPTION}, 10000, 'x')`,
    ).rejects.toThrow(/listings_one_active_per_unit_key/);
  });

  it('builds search text that finds a Thai district name', async () => {
    const rows = await db.sql`
      select id from public.listings where id = ${publishedListing} and search_text ilike ${'%วัฒนา%'}`;
    expect(rows).toHaveLength(1);
  });

  it('expires overdue listings through the maintenance function', async () => {
    const id = await createListing(alice, 'ประกาศที่หมดอายุแล้ว', 'published');
    await db.sql`update public.listings set expires_at = now() - interval '1 day' where id = ${id}`;
    await db.sql`select public.expire_listings()`;
    const [row] = await db.sql`select status from public.listings where id = ${id}`;
    expect(row?.status).toBe('expired');
  });

  it('keeps a private standalone property hidden until published', async () => {
    const [unit] = await db.sql`
      select u.property_id from public.listings l join public.property_units u on u.id = l.unit_id
      where l.id = ${draftListing}`;
    const rows = await asRole(db.sql, 'anon', null, (tx) =>
      tx`select id from public.properties where id = ${unit!.property_id}`);
    expect(rows).toHaveLength(0);
  });
});

describe('messaging', () => {
  it('lets participants read the conversation', async () => {
    const rows = await asRole(db.sql, 'authenticated', alice, (tx) =>
      tx`select id from public.messages where conversation_id = ${conversation}`);
    expect(rows).toHaveLength(1);
  });

  it('hides the conversation from anyone else, including another lister', async () => {
    const messages = await asRole(db.sql, 'authenticated', bob, (tx) =>
      tx`select id from public.messages where conversation_id = ${conversation}`);
    const conversations = await asRole(db.sql, 'authenticated', bob, (tx) =>
      tx`select id from public.conversations where id = ${conversation}`);
    expect(messages).toHaveLength(0);
    expect(conversations).toHaveLength(0);
  });

  it('blocks posting into a conversation you are not part of', async () => {
    await expect(
      asRole(db.sql, 'authenticated', bob, (tx) =>
        tx`insert into public.messages (conversation_id, sender_id, body) values (${conversation}, ${bob}, 'แอบส่ง')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('blocks impersonating another sender', async () => {
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`insert into public.messages (conversation_id, sender_id, body) values (${conversation}, ${alice}, 'ปลอมตัว')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('blocks messages once a participant is blocked', async () => {
    await db.sql`insert into public.user_blocks (blocker_id, blocked_id) values (${alice}, ${carol})`;
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`insert into public.messages (conversation_id, sender_id, body) values (${conversation}, ${carol}, 'ยังส่งได้ไหม')`),
    ).rejects.toThrow(/row-level security/);
    await db.sql`delete from public.user_blocks where blocker_id = ${alice}`;
  });
});

describe('personal data', () => {
  it('scopes favorites to the owner', async () => {
    await asRole(db.sql, 'authenticated', carol, (tx) =>
      tx`insert into public.favorites (user_id, listing_id) values (${carol}, ${publishedListing})`);
    const other = await asRole(db.sql, 'authenticated', bob, (tx) => tx`select * from public.favorites`);
    expect(other).toHaveLength(0);
    await expect(
      asRole(db.sql, 'authenticated', bob, (tx) =>
        tx`insert into public.favorites (user_id, listing_id) values (${carol}, ${draftListing})`),
    ).rejects.toThrow(/row-level security/);
  });

  it('restricts appointments to the two parties', async () => {
    const [appointment] = await asRole(db.sql, 'authenticated', carol, (tx) => tx`
      insert into public.appointments (listing_id, requester_id, owner_id, scheduled_at)
      values (${publishedListing}, ${carol}, ${alice}, now() + interval '2 days') returning id`);
    const outsider = await asRole(db.sql, 'authenticated', bob, (tx) =>
      tx`select id from public.appointments where id = ${appointment!.id}`);
    expect(outsider).toHaveLength(0);
    const owner = await asRole(db.sql, 'authenticated', alice, (tx) =>
      tx`select id from public.appointments where id = ${appointment!.id}`);
    expect(owner).toHaveLength(1);
    const [event] = await db.sql`select status from public.appointment_events where appointment_id = ${appointment!.id}`;
    expect(event?.status).toBe('requested');
  });

  it('hides notifications of other users and blocks forging them', async () => {
    await db.sql`insert into public.notifications (user_id, type, title, body) values (${carol}, 'test', 't', 'b')`;
    const other = await asRole(db.sql, 'authenticated', bob, (tx) => tx`select id from public.notifications`);
    expect(other).toHaveLength(0);
    await expect(
      asRole(db.sql, 'authenticated', bob, (tx) =>
        tx`insert into public.notifications (user_id, type, title, body) values (${carol}, 'fake', 't', 'b')`),
    ).rejects.toThrow(/row-level security/);
  });
});

describe('operations', () => {
  it('limits audit logs to admins and makes them append-only', async () => {
    await db.sql`insert into public.audit_logs (action, entity_type) values ('test.action', 'test')`;
    const member = await asRole(db.sql, 'authenticated', carol, (tx) => tx`select id from public.audit_logs`);
    expect(member).toHaveLength(0);
    const adminRows = await asRole(db.sql, 'authenticated', admin, (tx) => tx`select id from public.audit_logs`);
    expect(adminRows.length).toBeGreaterThan(0);
    await expect(db.sql`delete from public.audit_logs`).rejects.toThrow(/append-only/);
  });

  it('hides private settings from anon', async () => {
    const rows = await asRole(db.sql, 'anon', null, (tx) => tx`select key from public.application_settings`);
    const keys = rows.map((row) => row.key);
    expect(keys).toContain('daily_rental_enabled');
    expect(keys).not.toContain('listing_expiry_days');
  });

  it('restricts the rate limiter to the service role', async () => {
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) => tx`select public.rate_limit_hit('x', 1, 60)`),
    ).rejects.toThrow(/permission denied/);
  });

  it('counts hits inside a window', async () => {
    const hit = () => asRole(db.sql, 'service_role', null, (tx) =>
      tx`select public.rate_limit_hit('login:1.1.1.1', 2, 3600) as ok`);
    expect((await hit())[0]?.ok).toBe(true);
    expect((await hit())[0]?.ok).toBe(true);
    expect((await hit())[0]?.ok).toBe(false);
  });

  it('keeps clients out of storage objects', async () => {
    await expect(
      asRole(db.sql, 'authenticated', carol, (tx) =>
        tx`insert into storage.objects (bucket_id, name) values ('verification-docs', 'x.pdf')`),
    ).rejects.toThrow(/row-level security/);
  });

  it('marks verification documents as a private bucket', async () => {
    const [bucket] = await db.sql`select public from storage.buckets where id = 'verification-docs'`;
    expect(bucket?.public).toBe(false);
  });
});

describe('location data', () => {
  it('covers the whole country with a valid hierarchy', async () => {
    const counts = await db.sql`select level, count(*)::int as n from public.locations group by level`;
    const byLevel = Object.fromEntries(counts.map((row) => [row.level, row.n]));
    expect(byLevel.province).toBe(77);
    expect(byLevel.district).toBeGreaterThan(900);
    expect(byLevel.subdistrict).toBeGreaterThan(7000);

    const orphans = await db.sql`
      select c.code from public.locations c join public.locations p on p.id = c.parent_id
      where (c.level = 'district' and p.level <> 'province')
         or (c.level = 'subdistrict' and p.level <> 'district')`;
    expect(orphans).toEqual([]);
  });

  it('can be re-run safely', async () => {
    const before = await db.sql`select count(*)::int as n from public.locations`;
    const { readFileSync } = await import('node:fs');
    await db.sql.unsafe(readFileSync(new URL('../../../supabase/seed-locations.sql', import.meta.url), 'utf8'));
    const after = await db.sql`select count(*)::int as n from public.locations`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });
});

describe('deleting an account from the dashboard', () => {
  it('keeps the audit entry but drops the link to the deleted user', async () => {
    const id = await createUser(`deleted-${Date.now()}@example.com`);
    const [log] = await db.sql`
      insert into public.audit_logs (actor_id, action, entity_type) values (${id}, 'test.delete', 'test') returning id`;
    await db.sql`delete from auth.users where id = ${id}`;
    const [row] = await db.sql`select actor_id, action from public.audit_logs where id = ${log!.id}`;
    expect(row).toMatchObject({ actor_id: null, action: 'test.delete' });
  });

  it('still refuses any other edit of an audit entry', async () => {
    const [log] = await db.sql`insert into public.audit_logs (action, entity_type) values ('test.keep', 'test') returning id`;
    await expect(db.sql`update public.audit_logs set action = 'forged' where id = ${log!.id}`).rejects.toThrow(/append-only/);
  });
});
