# Setup Guide

## สิ่งที่ต้องมี

- Node.js 22 ขึ้นไป
- pnpm 10
- สำหรับ Mobile: แอป Expo Go หรือ Android Studio / Xcode

## ทางเลือกที่ 1: รันในเครื่องโดยไม่ต้องมี Supabase

```bash
pnpm install
pnpm dev:local
```

สคริปต์นี้เปิด PostgreSQL จริง รัน Migration และ Seed จากนั้นเปิด Auth/Storage จำลอง, API และ Web ไม่ส่งอีเมลจริง และยืนยันอีเมลให้อัตโนมัติ

เข้าใช้ด้วย `admin@example.com` / `Password123` ข้อมูลหายเมื่อหยุดโปรแกรม

## ทางเลือกที่ 2: ต่อ Supabase จริง

### 1. สร้างโปรเจกต์และส่ง Schema

สร้างโปรเจกต์ที่ https://supabase.com/dashboard ควรเลือก Region สิงคโปร์ แล้วรัน

```bash
pnpm exec supabase login
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push --remote --include-seed
pnpm exec supabase config push
```

ต้องใส่ `--remote` เสมอ ไม่เช่นนั้น CLI จะพยายามต่อ Supabase ในเครื่อง ส่วน `config push` ตั้ง Redirect URL, ปิด Data API และจำกัดขนาดไฟล์ตาม `supabase/config.toml` ใช้ `pnpm exec supabase config diff` เพื่อดูก่อนส่ง

### 2. ตั้งค่า Environment

```bash
pnpm setup:env
```

สคริปต์นี้สร้าง `apps/api/.env.local` และ `apps/web/.env.local` จากโปรเจกต์ที่ Link ไว้ เขียน Secret Key ลงไฟล์โดยไม่แสดงบนหน้าจอ และสุ่มค่า Secret ภายในให้ จากนั้นแก้ `YOUR_DB_PASSWORD` ใน `apps/api/.env.local` เป็นรหัสผ่านฐานข้อมูล ถ้าลืมให้ตั้งใหม่ที่ Project Settings, Database

ถ้าต้องการกรอกเองให้คัดลอกจากไฟล์ `.env.example` ของแต่ละแอป

| ตัวแปร | หาได้จาก |
|---|---|
| `SUPABASE_URL` | Project Settings, API |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings, API Keys |
| `DATABASE_URL` | Connect, Transaction pooler (พอร์ต 6543) |
| `INTERNAL_PROXY_SECRET` | สร้างเอง ค่าเดียวกันทั้ง API และ Web: `openssl rand -hex 32` |
| `CRON_SECRET` | สร้างเอง |

### 3. ตั้งค่าใน Supabase Dashboard

- **Authentication, Providers, Google:** (ไม่บังคับ) ใส่ Client ID และ Secret จาก Google Cloud Console

### 4. รัน

```bash
pnpm dev
```

### 5. สร้างผู้ดูแลคนแรก

สมัครสมาชิกผ่านหน้าเว็บ แล้วรันใน SQL Editor ของ Supabase

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'your-email@example.com';
```

ผู้ดูแลคนถัดไปแต่งตั้งได้จากหน้า Admin

### 6. ข้อมูลพื้นที่

Seed มีครบ 77 จังหวัด 930 อำเภอ และ 7,436 ตำบลพร้อมรหัสไปรษณีย์ จาก [kongvut/thai-province-data](https://github.com/kongvut/thai-province-data) (MIT) ไฟล์ `supabase/seed-locations.sql` รันซ้ำได้ อัปเดตชุดข้อมูลด้วย `scripts/generate-locations-seed.mjs`

## Mobile

```bash
pnpm dev:mobile
```

บน Android Emulator ให้ตั้ง `EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:4000/api/v1` บนเครื่องจริงให้ตั้งเป็น IP ของคอมพิวเตอร์ เช่น `http://192.168.1.10:4000/api/v1` เพราะ `localhost` หมายถึงตัวมือถือเอง

Push Notification ต้องสร้างโปรเจกต์ EAS ก่อน (`eas init`) และตั้ง `EXPO_PUSH_ENABLED=true` ที่ API

## การทดสอบ

```bash
pnpm test                 # Unit, RLS และ API Integration
pnpm build                # ต้อง Build ก่อนรัน E2E แบบ Production
cd apps/web && pnpm exec playwright install chromium
pnpm test:e2e
```

Test ไม่ต้องใช้ Docker หรือ Supabase ใช้ PostgreSQL 17 แบบ Embedded พอร์ต 3000, 4000 และ 54321 ต้องว่างตอนรัน E2E
