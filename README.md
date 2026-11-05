# HONGMUNG ห้องมึง

**ห้องใครก็หา ห้องเราก็เลือก**

แพลตฟอร์มซื้อ ขาย เช่า อสังหาริมทรัพย์สำหรับตลาดไทย ประกอบด้วย Web (Next.js), Mobile (Expo) และ Backend API (Next.js Route Handlers) บน Supabase

## เริ่มใช้งานเร็วที่สุด

ไม่ต้องมี Docker หรือโปรเจกต์ Supabase ใช้ PostgreSQL จริงพร้อม Migration จริง และ Auth/Storage จำลองในเครื่อง

```bash
pnpm install
pnpm dev:local
```

| | |
|---|---|
| Web | http://localhost:3000 |
| API | http://localhost:4000/api/v1 |
| Admin | `admin@example.com` / `Password123` |

ข้อมูลจะหายเมื่อหยุดโปรแกรม รายละเอียดการต่อ Supabase จริงอยู่ใน [docs/setup-guide.md](docs/setup-guide.md)

## คำสั่ง

| คำสั่ง | หน้าที่ |
|---|---|
| `pnpm dev:local` | รันทั้งระบบในเครื่องโดยไม่ต้องมี Supabase |
| `pnpm dev` | รัน API และ Web กับ Supabase จริง (ต้องตั้งค่า `.env`) |
| `pnpm dev:mobile` | รัน Expo |
| `pnpm typecheck` | ตรวจ TypeScript ทุกแพ็กเกจ |
| `pnpm lint` | ตรวจ ESLint |
| `pnpm test` | Unit, RLS และ API Integration Tests |
| `pnpm test:e2e` | Playwright User Journey |
| `pnpm build` | Production Build |
| `pnpm db:push` | ส่ง Migration ขึ้น Supabase |

## โครงสร้าง

```
apps/api       Backend API     (Route Handlers, Services, Repositories)
apps/web       Web             (BFF proxy, Server Components, Tailwind)
apps/mobile    Mobile          (Expo Router, React Native Paper)
packages/shared      Zod schemas, types, business rules, Thai formatting
packages/api-client  Typed client shared by web and mobile
packages/testing     Embedded PostgreSQL and Supabase stand-in (tests only)
supabase/      Migrations, seed, config
docs/          เอกสาร
```

## เอกสาร

- [Architecture](docs/architecture.md)
- [Database Schema](docs/database-schema.md)
- [API Documentation](docs/api-documentation.md)
- [Security](docs/security.md)
- [Setup Guide](docs/setup-guide.md)
- [คู่มือรันระบบ ทดสอบ และขึ้น Production](docs/production-guide.md) เริ่มอ่านที่นี่
- [Deployment Guide](docs/deployment-guide.md)
- [Implementation Plan](docs/implementation-plan.md)
