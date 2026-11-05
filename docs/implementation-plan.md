# Implementation Plan

| Phase | เนื้อหา | ผลลัพธ์ที่ตรวจสอบได้ |
|---|---|---|
| 1 | Requirements, Architecture, ER, Structure | เอกสารใน `docs/` |
| 2 | Monorepo, TypeScript, Lint, Shared, Env | `pnpm typecheck`, `pnpm lint` ผ่าน |
| 3 | Schema, Migrations, Seed, RLS, Storage | RLS Tests ผ่านบน PostgreSQL จริง |
| 4 | Auth, Profiles, RBAC | API Integration Tests |
| 5 | Property, Unit, Listing APIs | API Integration Tests |
| 6 | Web ค้นหาและรายละเอียด | Build + E2E |
| 7 | Web Dashboard ผู้ประกาศ | Build + E2E |
| 8 | Admin Dashboard | Build + E2E |
| 9 | Mobile | Typecheck + Bundle |
| 10 | Favorites, Messaging, Appointments, Notifications | API Tests + UI |
| 11 | Search Optimization, Security, Tests | Test ครบ |
| 12 | Performance, Accessibility, Build, Deployment | `pnpm build` ผ่าน + เอกสาร Deploy |

API ของ Phase 10 สร้างพร้อมกับ Phase 5 เพื่อให้ Web และ Mobile ต่อของจริงได้ตั้งแต่แรก โดยไม่มี Stub

## สิ่งที่ต้องทำต่อ

1. ไล่ส่วนที่ต้องตรวจด้วยมือใน [deployment-guide.md](deployment-guide.md) และตั้ง Custom SMTP
2. เปลี่ยนชื่อแบรนด์ชั่วคราว, Bundle ID และเพิ่มไอคอนแอป
3. ทดสอบ Push Notification ด้วย Development Build เพราะ Expo Go บน Android ไม่รองรับ Remote Push
4. ทดสอบบน iOS ซึ่งต้องใช้ macOS หรือ EAS Build
5. ปิดรายการใน [ข้อจำกัดที่ทราบ](security.md#ข้อจำกัดที่ทราบ) โดยเฉพาะ PDPA
