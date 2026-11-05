# Security

## ชั้นการป้องกัน

1. **Web/Mobile:** ไม่มี Secret ใด ๆ Token บน Web อยู่ใน httpOnly Cookie บน Mobile อยู่ใน SecureStore
2. **API:** ตรวจ JWT, โหลดสิทธิ์จากฐานข้อมูลทุกคำขอ, Validate ด้วย Zod, Rate Limit
3. **ฐานข้อมูล:** RLS และ Trigger ทำงานแม้โค้ด API ผิดพลาด เพราะคำขอของผู้ใช้รันด้วย Role `authenticated`

## ความเสี่ยงและการป้องกัน

| ความเสี่ยง | การป้องกัน | ทดสอบที่ |
|---|---|---|
| ยกระดับเป็น Admin เอง | ไม่มี Grant เขียน `user_roles` สำหรับ Client และ Metadata ตอนสมัครไม่มีผลกับ Role | `rls.test.ts`, `auth.test.ts` |
| IDOR แก้ประกาศคนอื่น | ตรวจใน Service และ RLS ตอบ 404 | `listings.test.ts`, `rls.test.ts` |
| อ่านบทสนทนาคนอื่น | RLS ผ่าน `is_conversation_participant` Admin ก็อ่านไม่ได้ | `interactions.test.ts` |
| ข้ามการตรวจสอบประกาศ | Trigger ห้าม Client เปลี่ยนเป็น `published` | `rls.test.ts` |
| SQL Injection | Query แบบ Parameter ทั้งหมด `%` และ `_` ในคำค้น Escape แล้ว | `search.test.ts` |
| XSS | React Escape ให้ เนื้อหาใน Popup แผนที่ Escape เอง ไม่มี `dangerouslySetInnerHTML` | `interactions.test.ts` |
| Script แปลกปลอม | CSP แบบ Nonce ใน `apps/web/src/proxy.ts` | `journey.spec.ts` |
| CSRF | Cookie `SameSite=Lax` และ BFF ตรวจ `Origin` ทุกคำขอที่เปลี่ยนข้อมูล | `journey.spec.ts` |
| ขโมย Token ผ่าน XSS | Cookie แบบ httpOnly และ BFF ไม่เปิด `/auth/refresh` | `journey.spec.ts` |
| Token ที่ระงับแล้วยังใช้ได้ | ตรวจสถานะจากฐานข้อมูลทุกคำขอ | `auth.test.ts`, `admin.test.ts` |
| Brute Force | Rate Limit ต่อ IP | `auth.test.ts` |
| สแปมข้อความ | Rate Limit ต่อผู้ใช้ และการบล็อก | `interactions.test.ts` |
| ค้นหาอีเมลในระบบ | ตอบเหมือนกันตอนสมัคร ล็อกอิน และลืมรหัสผ่าน | `auth.test.ts` |
| Open Redirect | ตรวจ `redirectTo` และ `next` | `auth.test.ts` |
| อัปโหลดไฟล์อันตราย | ถอดรหัสและเข้ารหัสรูปใหม่ ตรวจ PDF Magic Bytes ไม่รับ SVG | `media.test.ts` |
| GPS รั่วจาก EXIF | เข้ารหัสใหม่จึงไม่มี Metadata | `media.test.ts` |
| เอกสารส่วนตัวรั่ว | Private Bucket, Signed URL 5 นาที และบันทึกการเปิดดูใน Audit Log | `admin.test.ts` |
| ดูดเบอร์โทรจำนวนมาก | เบอร์และ LINE ส่งให้เฉพาะผู้ที่ล็อกอิน | `listings.test.ts` |
| Secret ใน Log | Log เฉพาะข้อความ Error ไม่ Log Request Body | ตรวจด้วยการรีวิว |
| แก้ Audit Log | Trigger ห้ามแก้ไขและลบ | `rls.test.ts` |

## ข้อจำกัดที่ทราบ

สิ่งเหล่านี้ยังไม่ได้ทำ ควรตัดสินใจก่อนเปิดใช้งานจริง

| รายการ | ผลกระทบ | แนะนำ |
|---|---|---|
| OAuth และลิงก์ในอีเมลใช้ Token ใน URL Fragment | Token อยู่ใน Fragment ชั่วครู่ก่อนย้ายเข้า Cookie | เปลี่ยนเป็น PKCE ถ้าต้องการเข้มงวดขึ้น |
| ไม่สแกนมัลแวร์ใน PDF | ผู้ดูแลอาจเปิดไฟล์อันตราย | เพิ่ม Antivirus Scan หรือรับเฉพาะรูป |
| Rate Limit แบบ Fixed Window | ขอบหน้าต่างอาจผ่านได้ถึงสองเท่าชั่วครู่ | เพียงพอสำหรับตอนนี้ |
| ยังไม่มีนโยบายเก็บข้อมูลตาม PDPA | เอกสารยืนยันตัวตนถูกเก็บไม่มีกำหนด | ปรึกษาฝ่ายกฎหมาย กำหนดระยะเวลาและหน้า Consent |
| ปิดบัญชีแล้วยังเก็บข้อความเดิม | ข้อความที่เคยส่งไม่ถูกลบ | ทบทวนกับนโยบาย PDPA |
| รูปของประกาศที่ `archived` ไม่ถูกลบอัตโนมัติ | ใช้พื้นที่เก็บเพิ่มขึ้น | เพิ่ม Cron ลบหลังเก็บถาวรตามระยะเวลาที่กำหนด |

## กฎการจัดการ Secret

- `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `CRON_SECRET`, `INTERNAL_PROXY_SECRET` ใช้ฝั่ง Server เท่านั้น
- ห้ามใส่ Secret ในตัวแปร `NEXT_PUBLIC_*` หรือ `EXPO_PUBLIC_*` เพราะจะถูก Compile เข้าแอป
- Web และ Mobile ไม่ต้องใช้ Supabase Key เลย
- ไฟล์ `.env*` ยกเว้น `.env.example` ถูก Ignore ใน Git
