# Deployment Guide

แนะนำให้แยก Supabase Project สำหรับ Staging และ Production

## ตัวแปรตามสภาพแวดล้อม

| ตัวแปร | ที่ใช้ | Development | Staging / Production |
|---|---|---|---|
| `SUPABASE_URL` | API | โปรเจกต์ Dev | โปรเจกต์ของแต่ละ Environment |
| `SUPABASE_SERVICE_ROLE_KEY` | API | | ตั้งใน Secret ของ Host |
| `DATABASE_URL` | API | | Transaction Pooler |
| `WEB_URL` | API | `http://localhost:3000` | URL จริงของ Web |
| `API_BASE_URL` | Web | `http://localhost:4000` | URL จริงของ API |
| `INTERNAL_PROXY_SECRET` | API, Web | | ค่าเดียวกันทั้งสองแอป |
| `IMAGE_ORIGIN` | Web | | `https://<ref>.supabase.co` ใช้ใน CSP |
| `CRON_SECRET` | API | | สุ่มใหม่ต่อ Environment |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | LAN IP | URL จริงของ API |

## 1. ฐานข้อมูล

```bash
pnpm exec supabase link --project-ref <project-ref>
pnpm exec supabase db push --remote --include-seed
pnpm exec supabase config push
```

ทุกการเปลี่ยน Schema ต้องเป็นไฟล์ Migration ใหม่ ห้ามแก้ไฟล์ที่ Deploy แล้ว

## 2. ตรวจสอบกับ Supabase จริงก่อนใช้งาน

Test อัตโนมัติใช้ Auth และ Storage จำลอง จึงต้องตรวจกับโปรเจกต์จริงทุก Environment ใหม่

**Smoke Test อัตโนมัติ** เปิด API และ Web แล้วรัน

```bash
pnpm build
pnpm --filter @rem/api start
pnpm --filter @rem/web start
pnpm smoke:supabase
```

สคริปต์ตรวจ 27 รายการผ่าน HTTP ได้แก่ Auth, การยืนยัน JWT, RLS, การอัปโหลด Storage, Private Bucket และ Signed URL, การปิด Data API, การระงับผู้ใช้ และ Audit Log สร้างผู้ใช้ทดสอบผ่าน Admin API จึงไม่ส่งอีเมล และลบข้อมูลทดสอบทั้งหมดเมื่อจบ ผ่านครบกับโปรเจกต์ `dptwvlfaiygpguyfoxjn` เมื่อ 2026-11-05

**ต้องตรวจด้วยมือ** เพราะต้องใช้กล่องอีเมลหรือบัญชีจริง

- [ ] สมัครสมาชิกแล้วได้รับอีเมล กดลิงก์แล้วเข้าระบบได้
- [ ] ลืมรหัสผ่าน ได้รับอีเมล ตั้งรหัสใหม่ได้
- [ ] ล็อกอินด้วย Google ทั้ง Web และ Mobile (ถ้าเปิดใช้)
- [ ] ทิ้งเซสชันบน Web ไว้เกิน 1 ชั่วโมงแล้วยังใช้งานต่อได้

**ก่อนเปิดให้ผู้ใช้จริง** ตั้ง Custom SMTP ที่ Authentication, Emails เพราะ SMTP เริ่มต้นของ Supabase จำกัดจำนวนอีเมลต่ำมากและไม่ได้ออกแบบมาสำหรับ Production

## 3. API และ Web

ตัวอย่างบน Vercel สร้างสองโปรเจกต์จาก Repository เดียวกัน

| | API | Web |
|---|---|---|
| Root Directory | `apps/api` | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile` | เหมือนกัน |
| Build Command | `pnpm build` | `pnpm build` |

- `apps/api/vercel.json` ตั้ง Cron หมดอายุประกาศทุกวัน Vercel ส่ง `CRON_SECRET` ให้อัตโนมัติ
- ถ้าใช้ Host อื่น ให้ตั้ง Scheduler ยิง `POST /api/v1/internal/expire` พร้อม Header `Authorization: Bearer $CRON_SECRET`
- `clientIp()` เชื่อ `x-forwarded-for` จาก Host ถ้า Host ไม่เขียนทับ Header นี้เอง ผู้โจมตีจะปลอม IP หลบ Rate Limit ได้ Vercel เขียนทับให้แล้ว
- ตั้ง `DATABASE_POOL_MAX` ให้เหมาะกับ Serverless (ค่าเริ่มต้น 5)

## 4. Mobile

ชื่อแอป ไอคอน Bundle ID (`com.hongmung.app`) และ `eas.json` ตั้งไว้แล้ว ก่อน Build ให้ตรวจว่า Bundle ID ตรงกับบัญชี Store ของคุณ

```bash
npm install -g eas-cli
cd apps/mobile
eas login
eas init
eas build --platform android
eas build --platform ios
eas submit
```

ตั้ง `EXPO_PUBLIC_API_BASE_URL` ใน EAS Environment ต้องมีบัญชี Apple Developer และ Google Play Console

## 5. หลัง Deploy

- ตั้ง Monitoring ที่ `GET /api/v1/health`
- ตั้ง Backup ของ Supabase (PITR สำหรับ Production)
- ตรวจ Security Advisor ใน Supabase Dashboard มันจะเตือน View `public_profiles` ที่ทำงานแบบ Security Definer ซึ่งตั้งใจไว้ เพื่อให้แสดงชื่อผู้ประกาศโดยไม่เปิดตาราง `profiles`
- ทบทวน [ข้อจำกัดที่ทราบ](security.md#ข้อจำกัดที่ทราบ)
