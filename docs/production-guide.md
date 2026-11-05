# คู่มือ HONGMUNG: รันระบบ ทดสอบ และขึ้น Production

คู่มือนี้พาทำตั้งแต่เปิดระบบในเครื่อง ไปจนถึงเปิดเว็บจริงบนโดเมนของคุณ ทำตามลำดับได้เลย

คู่มือนี้ใช้โดเมน `hongmung.com` ของแบรนด์ **HONGMUNG (ห้องมึง)**

## สถานะล่าสุด (5 พ.ย. 2569)

| รายการ | สถานะ |
|---|---|
| Web และ API ในเครื่อง | ใช้งานได้ |
| ฐานข้อมูล Supabase จริง | Migration ครบ 5 ไฟล์ ข้อมูลพื้นที่ครบ |
| API และ Web ต่อ Supabase จริง | ผ่าน Smoke Test 27 รายการ |
| อีเมลยืนยันการสมัคร | มีบัญชียืนยันสำเร็จแล้ว 1 บัญชี |
| Admin คนแรก | **ยังไม่มี** ดูขั้นตอนที่ 2 |
| Repo บน GitHub | แยก 4 Repo ดูขั้นตอนที่ 1 |
| โดเมน `hongmung.com` | **ยังไม่ได้จด** ดูขั้นตอนที่ 0 |
| Deploy ขึ้น Vercel | **ยังไม่เคยทำ** ครั้งแรกอาจต้องปรับค่าบางจุด |
| แอป Mobile | เปิดบน Android Emulator ได้ แต่ยังไม่เคย Build เพื่อขึ้น Store |

---

# ส่วนที่ 1: ทำความรู้จักโปรเจกต์

## ระบบมี 4 ส่วน

```
ผู้ใช้บนเว็บ  ──▶  Web (hongmung.com)  ──┐
                                           ├──▶  API (api.hongmung.com)  ──▶  Supabase
ผู้ใช้บนมือถือ  ──▶  แอป Mobile  ──────────┘                                  (ฐานข้อมูล ล็อกอิน ไฟล์)
```

- **Web:** หน้าเว็บที่ผู้ใช้เห็น
- **Mobile:** แอป Android และ iOS
- **API:** ตัวกลางที่ตรวจสิทธิ์และทำงานทั้งหมด Web และ Mobile ใช้ API ตัวเดียวกัน
- **Supabase:** เก็บข้อมูล บัญชีผู้ใช้ และรูปภาพ

## โฟลเดอร์สำคัญ

```
real-estate-marketplace/
├── apps/
│   ├── api/        Backend API
│   ├── web/        เว็บไซต์
│   └── mobile/     แอปมือถือ
├── packages/
│   ├── shared/     กฎธุรกิจและการตรวจข้อมูลที่ทุกแอปใช้ร่วมกัน
│   ├── api-client/ โค้ดเรียก API ที่ Web และ Mobile ใช้ร่วมกัน
│   ├── config/     การตั้งค่า TypeScript และ ESLint
│   └── testing/    ฐานข้อมูลจำลองสำหรับทดสอบ (ไม่ขึ้น Production)
├── supabase/
│   ├── migrations/ ไฟล์สร้างตารางฐานข้อมูล
│   ├── seed*.sql   ข้อมูลตั้งต้น เช่น จังหวัด อำเภอ ตำบล
│   └── config.toml การตั้งค่า Supabase
├── scripts/        สคริปต์ช่วยงาน
└── docs/           เอกสาร
```

## ไฟล์ตั้งค่าลับ

| ไฟล์ | ใช้กับ |
|---|---|
| `apps/api/.env.local` | API ในเครื่อง มีคีย์ลับ |
| `apps/web/.env.local` | Web ในเครื่อง |
| `apps/mobile/.env` | แอปมือถือในเครื่อง |

ไฟล์เหล่านี้ไม่ถูกส่งขึ้น GitHub ห้ามส่งคีย์ลับในแชตหรือใส่ในโค้ด

---

# ส่วนที่ 2: รันในเครื่องและลองเล่น

ติดตั้งครั้งแรก (ต้องมี Node.js 22 และ pnpm 10)

```powershell
pnpm install
```

**ทุกคำสั่งในคู่มือนี้ให้รันที่โฟลเดอร์หลัก** `real-estate-marketplace` ถ้าอยู่ในโฟลเดอร์ย่อยจะขึ้น `Command "dev:local" not found`

## เลือกโหมดก่อนเริ่ม

| | โหมดทดลอง (แนะนำ) | โหมดข้อมูลจริง |
|---|---|---|
| ฐานข้อมูล | ชั่วคราวในเครื่อง หายเมื่อปิด | Supabase จริง |
| อีเมลยืนยัน | ไม่ต้องยืนยัน เข้าใช้ได้ทันที | ส่งจริง และจำกัดจำนวน |
| ลองผิดลองถูก | ทำได้เต็มที่ | **ทุกอย่างกระทบข้อมูลจริง** |
| วิธีเปิด | `pnpm dev:local` เปิด API และ Web พร้อมกัน | เปิด API และ Web แยกกัน |

โหมดทดลองแยก API กับ Web ไม่ได้ เพราะทั้งคู่ใช้ฐานข้อมูลชั่วคราวชุดเดียวกัน แต่ลองเล่นทีละส่วนได้ตามหัวข้อด้านล่าง

## เปิดระบบ

### โหมดทดลอง

เปิดหน้าต่าง Terminal แล้วรัน

```powershell
pnpm dev:local
```

รอจนขึ้น `Local stack ready` แล้วปล่อยหน้าต่างนี้เปิดไว้ บัญชี Admin คือ `admin@example.com` / `Password123`

ฐานข้อมูลเริ่มว่างทุกครั้ง จึงยังไม่มีประกาศจนกว่าจะสร้างตามหัวข้อ "ลองเล่น Web"

### โหมดข้อมูลจริง

เปิดสองหน้าต่าง Terminal

```powershell
# หน้าต่างที่ 1: API
pnpm --filter @rem/api dev

# หน้าต่างที่ 2: Web (ต้องเปิด API ก่อน)
pnpm --filter @rem/web dev
```

จะเปิดทั้งสองพร้อมกันในหน้าต่างเดียวด้วย `pnpm dev` ก็ได้

กด `Ctrl + C` ในหน้าต่างนั้นเพื่อหยุด

## ลองเล่น API

ที่อยู่: http://localhost:4000/api/v1

เปิดลิงก์เหล่านี้ในเบราว์เซอร์ได้เลย

| ลิงก์ | จะเห็น |
|---|---|
| http://localhost:4000/api/v1/health | `{"data":{"status":"ok"}}` แปลว่า API ทำงาน |
| http://localhost:4000/api/v1/categories | ประเภทอสังหาริมทรัพย์ |
| http://localhost:4000/api/v1/locations?level=province | 77 จังหวัด |
| http://localhost:4000/api/v1/listings | ประกาศที่เผยแพร่แล้ว |
| http://localhost:4000/api/v1/auth/me | Error 401 เพราะยังไม่ได้ล็อกอิน ซึ่งถูกต้อง |

ลองล็อกอินจาก PowerShell (ตัวอย่างนี้ใช้กับโหมดทดลอง) เปิดหน้าต่างใหม่แล้ววางทีละบรรทัด

```powershell
$api = "http://localhost:4000/api/v1"
$body = @{ email = "admin@example.com"; password = "Password123" } | ConvertTo-Json
$login = Invoke-RestMethod "$api/auth/login" -Method Post -ContentType "application/json" -Body $body
$headers = @{ Authorization = "Bearer $($login.data.session.accessToken)" }

# ดูข้อมูลบัญชี
(Invoke-RestMethod "$api/auth/me" -Headers $headers).data | Format-List email, roles

# ดูตัวเลขภาพรวมของ Admin
(Invoke-RestMethod "$api/admin/dashboard" -Headers $headers).data.totals | Format-List users, listings, pendingListings
```

รายการ API ทั้งหมดอยู่ใน [api-documentation.md](api-documentation.md)

## ลองเล่น Web

ที่อยู่: http://localhost:3000 (ต้องเปิด API อยู่)

ลองตามลำดับนี้เพื่อให้เห็นครบทุกบทบาท ใช้หน้าต่างปกติเป็นผู้ใช้ และหน้าต่าง Incognito เป็น Admin จะได้ไม่ต้องสลับบัญชีไปมา

**ผู้ลงประกาศ (หน้าต่างปกติ)**

1. กด **สมัครสมาชิก** ใช้อีเมลอะไรก็ได้ เช่น `owner@example.com`
2. กด **ลงประกาศ** แล้วเลือก **เจ้าของทรัพย์**
3. กรอกข้อมูลแล้วกด **บันทึกฉบับร่าง**
4. กด **เพิ่มรูปภาพ** แล้วกด **ส่งตรวจสอบ**

**Admin (หน้าต่าง Incognito)**

5. เข้าสู่ระบบด้วยบัญชี Admin แล้วเปิด http://localhost:3000/admin
6. ไปที่เมนู **ประกาศ** กดชื่อประกาศ แล้วกด **อนุมัติ**

**ผู้สนใจ (ออกจากระบบในหน้าต่างปกติ แล้วสมัครบัญชีใหม่ เช่น `buyer@example.com`)**

7. ค้นหาประกาศจากหน้าแรก แล้วลองตัวกรองในหน้าค้นหา
8. เปิดประกาศ กดหัวใจ แล้วลอง **ส่งข้อความ** และ **นัดดูห้อง**
9. ล็อกอินกลับเป็นเจ้าของ เพื่อตอบข้อความและยืนยันนัด

ลองเปิดเว็บแบบจอมือถือได้ด้วยการกด `F12` แล้วกดไอคอนมือถือ

## ลองเล่น Mobile

แอปต้องคุยกับ API ดังนั้นต้องเปิดโหมดใดโหมดหนึ่งไว้ก่อน

### บน Android Emulator (แนะนำ)

ค่าใน `apps/mobile/.env` ตั้งไว้สำหรับวิธีนี้แล้ว เครื่องนี้มี Emulator ชื่อ `rem_test` อยู่แล้ว

```powershell
# หน้าต่างที่ 1: เปิด Emulator แล้วรอจนเห็นหน้าจอ Android
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd rem_test

# หน้าต่างที่ 2: เปิดแอป
pnpm --filter @rem/mobile android
```

ครั้งแรกระบบจะติดตั้ง Expo Go ให้เอง และใช้เวลาโหลดสักครู่

ถ้าใช้โหมดทดลอง ให้รันคำสั่งนี้อีกครั้งเพื่อให้รูปภาพแสดงในแอป

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:54321 tcp:54321
```

### บนมือถือจริง

1. ติดตั้ง **Expo Go** จาก Store ต้องเป็นเวอร์ชันที่รองรับ Expo SDK 58
2. ให้มือถือและคอมพิวเตอร์ต่อ Wi-Fi เดียวกัน
3. ดู IP ของคอมพิวเตอร์ด้วยคำสั่ง `ipconfig` เช่น `192.168.1.10`
4. แก้ `apps/mobile/.env` เป็น `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.10:4000/api/v1`
5. รัน `pnpm dev:mobile` แล้วใช้ Expo Go สแกน QR Code

ถ้าแอปต่อ API ไม่ได้ ให้อนุญาตพอร์ต 4000 ใน Windows Firewall ในโหมดทดลอง รูปภาพจะไม่แสดงบนมือถือจริง ให้ใช้ Emulator หรือโหมดข้อมูลจริงถ้าต้องการดูรูป

### สิ่งที่ลองได้ในแอป

1. แท็บ **โปรไฟล์** > **เข้าสู่ระบบ** ใช้บัญชีเดียวกับที่สมัครบนเว็บ
2. แท็บ **หน้าแรก** ดึงหน้าจอลงเพื่อโหลดใหม่ แล้วกดเปิดประกาศ
3. ลอง **บันทึก**, **ส่งข้อความ** และ **นัดดูห้อง**
4. แท็บ **ข้อความ** ดูบทสนทนา ซึ่งเห็นตรงกับบนเว็บ
5. แท็บ **โปรไฟล์** > **ลงประกาศใหม่** (ต้องเลือกเป็นผู้ประกาศก่อน)

Push Notification ใช้ไม่ได้ใน Expo Go เป็นข้อจำกัดของ Expo ไม่ใช่ปัญหาของแอป

## ปัญหาที่พบบ่อยตอนรันในเครื่อง

| อาการ | วิธีแก้ |
|---|---|
| `Command "dev:local" not found` | รันจากโฟลเดอร์หลัก ไม่ใช่ใน `apps/` |
| `Port ... is already in use` | ปิดโปรแกรมที่รันค้างอยู่ด้วย `Ctrl + C` หรือปิดหน้าต่างนั้น |
| หน้าเว็บขึ้น "ไม่สามารถโหลดประกาศได้" | ยังไม่ได้เปิด API |
| แอปขึ้น "กรุณาตรวจสอบการเชื่อมต่อ" | ยังไม่ได้เปิด API หรือค่าใน `apps/mobile/.env` ไม่ตรงกับเครื่องที่ใช้ |
| แก้ `apps/mobile/.env` แล้วไม่มีผล | ปิด Expo แล้วรันใหม่ด้วย `pnpm exec expo start --clear` ในโฟลเดอร์ `apps/mobile` |
| แอปจอแดงหลังเปลี่ยนโค้ด | กด `r` ในหน้าต่าง Expo เพื่อโหลดใหม่ |
| `PluginError: Failed to resolve plugin` | รัน `pnpm install` ที่โฟลเดอร์หลัก แล้วเปิด Expo ใหม่ |
| ใช้ `expo start --tunnel` แล้วแอปเปิดได้ แต่โหลดข้อมูลไม่ได้ | `--tunnel` ส่งผ่านเฉพาะตัวแอป ไม่รวม API มือถือจริงต้องเข้าถึง API ได้เอง ใช้ LAN IP เมื่ออยู่ Wi-Fi เดียวกัน หรือ URL ของ API ที่ Deploy แล้ว |

---

# ส่วนที่ 3: ทดสอบ

**ก่อน Deploy ทุกครั้งให้รันชุดนี้ตามลำดับ และให้ผ่านทั้งหมด**

```powershell
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

| คำสั่ง | ตรวจอะไร | ผลล่าสุด |
|---|---|---|
| `pnpm typecheck` | โค้ดถูกชนิดข้อมูล | ผ่าน |
| `pnpm lint` | คุณภาพโค้ด | ผ่าน |
| `pnpm test` | กฎธุรกิจ สิทธิ์ และ API (ไม่แตะข้อมูลจริง) | 216 เคสผ่าน |
| `pnpm build` | Build สำหรับ Production | ผ่าน |
| `pnpm test:e2e` | เปิดเบราว์เซอร์จริงแล้วลองใช้งานทั้ง Flow | 14 เคสผ่าน |

ข้อควรระวัง:

- ก่อนรัน `pnpm test:e2e` ต้องปิดโปรแกรมที่ใช้พอร์ต 3000, 4000 และ 54321
- ครั้งแรกต้องติดตั้งเบราว์เซอร์ด้วย `cd apps/web; pnpm exec playwright install chromium`
- อย่ารัน `typecheck` กับ `build` พร้อมกัน เพราะใช้โฟลเดอร์เดียวกัน

## ทดสอบกับ Supabase จริง

เปิด API และ Web ด้วย `pnpm --filter @rem/api start` และ `pnpm --filter @rem/web start` คนละหน้าต่าง แล้วรัน

```powershell
pnpm smoke:supabase
```

สคริปต์สร้างผู้ใช้ทดสอบชั่วคราวและลบออกเมื่อจบ ไม่ส่งอีเมล และแสดง `PASS` หรือ `FAIL` ทีละข้อ

---

# ส่วนที่ 4: ขึ้น Production

## แผนภาพสิ่งที่จะทำ

| ที่อยู่ | คืออะไร | อยู่ที่ไหน |
|---|---|---|
| `hongmung.com` | เว็บไซต์ | Vercel |
| `www.hongmung.com` | ส่งต่อไปที่ `hongmung.com` | Vercel |
| `api.hongmung.com` | API | Vercel |
| `dptwvlfaiygpguyfoxjn.supabase.co` | ฐานข้อมูลและไฟล์ | Supabase |

## สิ่งที่ต้องเตรียม

- [ ] โดเมน `hongmung.com` (ขั้นตอนที่ 0)
- [ ] บัญชี GitHub
- [ ] บัญชี Vercel
- [ ] บริการส่งอีเมล เช่น Resend, SendGrid หรือ AWS SES

**เรื่องแพ็กเกจที่ควรรู้ก่อนเริ่ม**

- **Vercel:** แพ็กเกจฟรี (Hobby) ใช้ได้เฉพาะงานส่วนตัวที่ไม่ใช่เชิงพาณิชย์ เว็บอสังหาที่ทำธุรกิจต้องใช้แพ็กเกจ Pro
- **Supabase:** ควรใช้แพ็กเกจเสียเงินสำหรับ Production และเปิด Backup ตรวจราคาและเงื่อนไขล่าสุดในหน้าเว็บผู้ให้บริการ

---

## ขั้นตอนที่ 0: จดโดเมน hongmung.com

เมื่อ 5 พ.ย. 2569 ระบบ RDAP ของ `.com` ไม่พบการจดชื่อนี้ แปลว่ายังว่างอยู่ ณ ตอนตรวจ ควรรีบจดก่อนมีคนอื่นจด

1. เลือกผู้ให้บริการจดโดเมนที่น่าเชื่อถือ เช่น Cloudflare Registrar, Namecheap หรือผู้ให้บริการในไทย
2. ค้นหา `hongmung.com` และตรวจราคาทั้ง **ปีแรกและปีต่ออายุ** บางเจ้าปีแรกถูกแต่ปีถัดไปแพงกว่า
3. จดในชื่อคุณหรือบริษัท และใช้อีเมลที่คุณเข้าถึงได้ระยะยาว เพราะถ้าเสียอีเมลนี้อาจเสียโดเมนด้วย
4. เปิด **Auto-renew** เพื่อไม่ให้โดเมนหลุด
5. เปิด **WHOIS Privacy** เพื่อซ่อนข้อมูลส่วนตัว
6. เปิด **2FA** ในบัญชีผู้จดโดเมน

**ยังไม่ต้องแก้ DNS ตอนนี้** รอทำในขั้นตอนที่ 5

ถ้าจะใช้ชื่อนี้ทำธุรกิจระยะยาว ควรตรวจและจดเครื่องหมายการค้ากับกรมทรัพย์สินทางปัญญาด้วย

---

## ขั้นตอนที่ 1: โค้ดบน GitHub

โค้ดแยกอยู่ 4 Repo

| โฟลเดอร์ | Repo | Branch |
|---|---|---|
| `apps/api` | `real-estate-marketplace-API` | `master` |
| `apps/web` | `real-estate-marketplace-Frontend` | `master` |
| `apps/mobile` | `real-estate-marketplace-Mobile` | `master` |
| ที่เหลือทั้งหมด (`packages`, `supabase`, `docs`, `scripts`) | `real-estate-marketplace-Shared` | `main` |

ใน SourceTree ให้เปิดทีละโฟลเดอร์ตามตารางนี้ แก้ไฟล์ในโฟลเดอร์ไหนก็ Commit ที่ Repo นั้น

**ข้อจำกัดสำคัญ:** ทุกแอปต้องใช้ `packages/` จาก Repo Shared ดังนั้น **Vercel Build จาก Repo ของแอปโดยตรงไม่ได้** ต้องเลือกหนึ่งในสองทางนี้ก่อนทำขั้นตอนที่ 3

**ทาง A: เพิ่ม Repo สำหรับ Deploy ที่รวมโค้ดทั้งหมด (แนะนำ)**

วิธีนี้ตรงกับขั้นตอนที่ 3 และ 4 และ Vercel จะ Deploy ให้เองทุกครั้งที่ Push แต่ต้องเปลี่ยนวิธีเก็บโค้ดเป็น Repo เดียว

**ทาง B: Deploy จากเครื่องด้วย Vercel CLI**

คงการแยก Repo ไว้ได้ เพราะ CLI อัปโหลดไฟล์จากเครื่องโดยตรง แต่ต้องสั่ง Deploy เองทุกครั้ง **ยังไม่ได้ทดสอบกับโปรเจกต์นี้** และเอกสาร Vercel ระบุข้อจำกัดของ CLI กับ Monorepo ไว้ ควรลองกับโปรเจกต์ทดสอบก่อน

---

## ขั้นตอนที่ 2: เตรียม Supabase

### 2.1 สร้าง Admin คนแรก

เปิด SQL Editor ใน Supabase Dashboard ใส่อีเมลของคุณแล้วกด Run

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'อีเมลของคุณ';
```

### 2.2 ตั้ง Custom SMTP (จำเป็น)

**ถ้าไม่ตั้ง ผู้ใช้ทั่วไปจะสมัครสมาชิกไม่ได้** เพราะอีเมลในตัวของ Supabase ส่งถึงได้เฉพาะสมาชิกทีมในองค์กรของคุณ และส่งได้เพียงประมาณ 2 ฉบับต่อชั่วโมง

1. สมัครบริการส่งอีเมล และยืนยันโดเมนตามขั้นตอนของบริการนั้น
2. ไปที่ Supabase Dashboard > Authentication > Emails > SMTP Settings แล้วกรอกข้อมูล
3. ตั้งผู้ส่งเป็นอีเมลโดเมนของคุณ เช่น `no-reply@hongmung.com`
4. **ปิด Link Tracking** ในบริการส่งอีเมล เพราะอาจทำให้ลิงก์ยืนยันใช้ไม่ได้
5. หลังตั้งเสร็จ Supabase จะจำกัดเริ่มต้นที่ 30 ฉบับต่อชั่วโมง ปรับได้ที่ Authentication > Rate Limits

---

## ขั้นตอนที่ 3: Deploy API

เตรียมค่าลับใหม่สำหรับ Production สองค่า รันคำสั่งนี้สองครั้ง แล้วเก็บไว้เป็น `INTERNAL_PROXY_SECRET` และ `CRON_SECRET`

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

1. ใน Vercel กด **Add New > Project** แล้วเลือก Repo
2. ตั้งค่า

| ช่อง | ค่า |
|---|---|
| Project Name | `hongmung-api` |
| Framework Preset | Next.js |
| Root Directory | `apps/api` |

3. เพิ่ม Environment Variables

| ชื่อ | ค่า |
|---|---|
| `SUPABASE_URL` | `https://dptwvlfaiygpguyfoxjn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | คัดลอกจาก `apps/api/.env.local` |
| `DATABASE_URL` | คัดลอกจาก `apps/api/.env.local` (พอร์ต 6543) |
| `WEB_URL` | `https://hongmung.com` (ไม่มี `/` ท้าย) |
| `INTERNAL_PROXY_SECRET` | ค่าที่สร้างใหม่ |
| `CRON_SECRET` | ค่าที่สร้างใหม่ |
| `DATABASE_POOL_MAX` | `2` |

ไม่ต้องตั้ง `ALLOWED_ORIGINS` เพราะเว็บเรียก API ฝั่ง Server จึงไม่เกี่ยวกับ CORS

4. กด **Deploy**
5. ไปที่ Project Settings > Functions แล้วตั้ง **Function Region** เป็น **Seoul (icn1)** เพราะฐานข้อมูลอยู่ที่โซล ถ้าปล่อยเป็นค่าเริ่มต้น (สหรัฐฯ) ระบบจะช้าลงมาก จากนั้น Redeploy

---

## ขั้นตอนที่ 4: Deploy Web

1. กด **Add New > Project** แล้วเลือก Repo **เดิม** อีกครั้ง
2. ตั้งค่า

| ช่อง | ค่า |
|---|---|
| Project Name | `hongmung-web` |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |

3. เพิ่ม Environment Variables

| ชื่อ | ค่า |
|---|---|
| `SITE_URL` | `https://hongmung.com` (ใช้กับ Canonical, Sitemap และ Robots) |
| `API_BASE_URL` | `https://api.hongmung.com` (ไม่มี `/api/v1` และไม่มี `/` ท้าย) |
| `INTERNAL_PROXY_SECRET` | **ค่าเดียวกับ API** |
| `IMAGE_ORIGIN` | `https://dptwvlfaiygpguyfoxjn.supabase.co` |

4. กด **Deploy**
5. ตั้ง Function Region เป็น **Seoul (icn1)** แล้ว Redeploy

ตอนนี้หน้าเว็บอาจยังโหลดข้อมูลไม่ได้ เพราะ `api.hongmung.com` ยังไม่พร้อม ทำขั้นตอนถัดไปต่อได้เลย

---

## ขั้นตอนที่ 5: เชื่อมโดเมน

### 5.1 เพิ่มโดเมนใน Vercel

- โปรเจกต์ `hongmung-api`: Settings > Domains > เพิ่ม `api.hongmung.com`
- โปรเจกต์ `hongmung-web`: Settings > Domains > เพิ่ม `hongmung.com` และ `www.hongmung.com`
- ตั้ง `www.hongmung.com` ให้ **Redirect ไปที่ `hongmung.com`**

ข้อสุดท้ายสำคัญ ถ้าไม่ตั้ง การล็อกอินผ่านอีเมลจาก `www` จะไม่ผ่าน เพราะไม่ตรงกับ `WEB_URL`

### 5.2 เพิ่ม DNS ที่ผู้ให้บริการโดเมน

เข้าหน้าจัดการ DNS แล้วเพิ่มรายการตามที่ Vercel แสดงในหน้า Domains **ให้ใช้ค่าจากหน้า Vercel ของคุณเป็นหลัก** ตารางนี้เป็นตัวอย่าง

| Type | Name / Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | ค่าที่ Vercel แสดง |
| CNAME | `api` | ค่าที่ Vercel แสดง |

ข้อควรระวัง:

- ลบระเบียน `A` และ `AAAA` เก่าของ `@` ออกก่อน เพราะทำให้การยืนยันโดเมนและ SSL ติดขัดได้
- ช่อง Name ใส่แค่ `www` หรือ `api` ไม่ต้องใส่ชื่อโดเมนเต็ม
- ถ้าใช้ Cloudflare ให้ตั้งเป็น **DNS only** (เมฆสีเทา)

DNS มักใช้เวลาไม่กี่นาทีถึงหลายชั่วโมง เมื่อหน้า Domains ของ Vercel ขึ้น **Valid Configuration** แปลว่าใช้ได้แล้ว Vercel จะออกใบรับรอง HTTPS ให้เอง

---

## ขั้นตอนที่ 6: บอก Supabase ว่าใช้โดเมนจริงแล้ว

แก้บรรทัดเดียวใน `supabase/config.toml` ใต้หัวข้อ `[auth]` ส่วน Redirect URL ของ `hongmung.com` และแอปตั้งไว้ให้แล้ว

```toml
site_url = "https://hongmung.com"
```

จากนั้นรัน

```powershell
pnpm exec supabase config diff
pnpm exec supabase config push
git add supabase/config.toml
git commit -m "Set production auth URLs"
git push
```

ถ้าข้ามขั้นนี้ ลิงก์ในอีเมลจะพาผู้ใช้ไป `localhost`

---

## ขั้นตอนที่ 7: ตรวจระบบจริง

ตรวจ API

```powershell
curl.exe https://api.hongmung.com/api/v1/health
```

ต้องได้ `{"data":{"status":"ok"}}`

จากนั้นลองใช้เว็บจริงตามรายการนี้

- [ ] เปิด `https://hongmung.com` เห็นแม่กุญแจ และเห็นหน้าแรก
- [ ] เปิด `https://www.hongmung.com` แล้วถูกส่งไป `hongmung.com`
- [ ] สมัครด้วยอีเมลที่ **ไม่ใช่** อีเมลทีม Supabase ได้รับอีเมล และกดลิงก์แล้วกลับมาที่โดเมนจริง
- [ ] ลืมรหัสผ่านและตั้งรหัสใหม่ได้
- [ ] ลงประกาศพร้อมรูปภาพ และรูปแสดงบนหน้าเว็บ
- [ ] Admin อนุมัติประกาศได้ และประกาศแสดงในหน้าค้นหา
- [ ] ส่งข้อความและนัดหมายได้
- [ ] แผนที่ในหน้าประกาศแสดงได้
- [ ] ทิ้งเว็บไว้เกิน 1 ชั่วโมง กลับมาแล้วยังล็อกอินอยู่
- [ ] Vercel โปรเจกต์ `hongmung-api` แท็บ Cron Jobs มีงาน `/api/v1/internal/expire`

งานหมดอายุประกาศตั้งไว้ราวตี 1 ตามเวลาไทยทุกวัน แพ็กเกจ Hobby อาจคลาดเคลื่อนได้ภายในชั่วโมงนั้น

---

## ขั้นตอนที่ 8: เอาแอปขึ้น Store

ทำหลังเว็บใช้งานได้แล้ว ต้องมีบัญชี Google Play Console และ Apple Developer

### 8.1 เตรียมแอป

ชื่อแอป HONGMUNG ไอคอน Splash Screen และ Bundle ID `com.hongmung.app` ตั้งไว้แล้วใน `apps/mobile/app.json`

ตรวจก่อนว่า Bundle ID นี้ใช้ได้ในบัญชี Store ของคุณ เพราะ **เมื่อขึ้น Store แล้วเปลี่ยนไม่ได้**

### 8.2 ตั้งค่า EAS

เครื่องนี้ติดตั้ง `eas` แล้ว

```powershell
cd apps/mobile
eas login
eas init
```

ไฟล์ `apps/mobile/eas.json` ตั้ง API เป็น `https://api.hongmung.com/api/v1` ไว้แล้ว

### 8.3 Build และส่งขึ้น Store

```powershell
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android
eas submit --platform ios
```

ก่อนส่งจริงควรลองแอปที่ Build แล้วบนเครื่องจริง เพราะที่ผ่านมาทดสอบแค่บน Emulator ผ่าน Expo Go

ถ้าต้องการ Push Notification ให้เพิ่ม `EXPO_PUSH_ENABLED=true` ที่โปรเจกต์ `hongmung-api` แล้ว Redeploy

---

# ส่วนที่ 5: การดูแลหลังเปิดระบบ

## อัปเดตเว็บ

ตรวจโค้ดก่อน

```powershell
pnpm typecheck; pnpm lint; pnpm test
```

จากนั้น Commit และ Push ใน Repo ของโฟลเดอร์ที่แก้ ถ้าใช้ทาง A Vercel จะ Deploy ให้เอง ถ้าใช้ทาง B ต้องสั่ง Deploy เอง

ถ้า Deploy แล้วมีปัญหา เปิด Vercel > Deployments เลือกเวอร์ชันก่อนหน้า แล้วกด **Promote to Production** เพื่อย้อนกลับ

## แก้โครงสร้างฐานข้อมูล

1. สร้างไฟล์ Migration **ใหม่** ใน `supabase/migrations` ห้ามแก้ไฟล์เดิมที่ขึ้นไปแล้ว
2. รัน `pnpm test` ให้ผ่าน
3. รัน `pnpm db:push`
4. จากนั้นค่อย `git push` เพื่อ Deploy โค้ด

ควร Backup ก่อนทุกครั้ง และเลือกทำช่วงที่มีผู้ใช้น้อย

## เปลี่ยนคีย์หรือ Environment Variable

แก้ที่ Vercel > Settings > Environment Variables แล้วต้อง **Redeploy** ค่าใหม่จึงจะมีผล

---

# ส่วนที่ 6: แก้ปัญหาที่พบบ่อย

| อาการ | สาเหตุที่น่าจะเป็น | วิธีแก้ |
|---|---|---|
| Vercel Build ไม่ผ่าน | Root Directory ผิด หรือไม่ได้ Commit `pnpm-lock.yaml` | ตรวจว่าเป็น `apps/api` หรือ `apps/web` และดู Log ใน Deployments |
| `/health` ตอบ 500 | `DATABASE_URL` ผิด | ตรวจรหัสผ่านและพอร์ต 6543 ถ้ารหัสมี `@ : / ? #` ต้อง URL-encode |
| เว็บขึ้น "ไม่สามารถโหลดประกาศได้" | `API_BASE_URL` ผิด หรือโดเมน API ยังไม่พร้อม | ลองเปิด `/health` ก่อน และห้ามมี `/` หรือ `/api/v1` ท้ายค่า |
| ล็อกอินแล้วขึ้น `CSRF_REJECTED` | เรียกข้ามโดเมน | ใช้งานผ่าน `hongmung.com` และตรวจการ Redirect จาก `www` |
| ขึ้น `redirectTo ไม่ได้รับอนุญาต` | `WEB_URL` ไม่ตรงกับโดเมนที่ใช้ | แก้ `WEB_URL` แล้ว Redeploy |
| ไม่ได้รับอีเมล | ยังไม่ตั้ง Custom SMTP หรือเกิน Rate Limit | ทำขั้นตอน 2.2 และดู Authentication > Logs |
| ลิงก์ในอีเมลพาไป localhost | ยังไม่ทำขั้นตอนที่ 6 | แก้ `site_url` แล้ว `config push` |
| รูปไม่แสดง | `IMAGE_ORIGIN` ผิด | ต้องเป็น URL โปรเจกต์ Supabase เต็ม |
| แผนที่หรือบางส่วนของเว็บไม่ทำงาน | CSP บล็อก | กด F12 ดู Console แล้วแก้รายการใน `apps/web/src/proxy.ts` |
| ทุกคนโดน "ส่งคำขอถี่เกินไป" | `INTERNAL_PROXY_SECRET` ของ API กับ Web ไม่ตรงกัน | ตั้งให้ตรงกันแล้ว Redeploy ทั้งสองโปรเจกต์ |
| ระบบช้าผิดปกติ | Function Region ไม่ใช่ Seoul | ตั้งเป็น `icn1` แล้ว Redeploy |
| โดเมนค้างที่ Invalid Configuration | ระเบียน DNS เก่ายังอยู่ หรือยังไม่กระจาย | ลบ A/AAAA เก่า ตรวจค่าให้ตรงหน้า Vercel แล้วรอ |

---

# สิ่งที่ควรทำก่อนเปิดให้คนทั่วไปใช้

- [ ] ส่ง Sitemap ที่ Google Search Console: `https://hongmung.com/sitemap.xml`
- [ ] ตั้ง Custom SMTP
- [ ] เปิด Backup ของ Supabase
- [ ] กำหนดนโยบายความเป็นส่วนตัวและระยะเวลาเก็บเอกสารยืนยันตัวตนตาม PDPA โดยปรึกษาฝ่ายกฎหมาย
- [ ] เพิ่มหน้าเงื่อนไขการใช้งานและนโยบายความเป็นส่วนตัว (จำเป็นสำหรับการขึ้น Store ด้วย)
- [ ] ดูข้อจำกัดที่เหลือใน [security.md](security.md)

## เอกสารอ้างอิงในโปรเจกต์

- [setup-guide.md](setup-guide.md) ตั้งค่าเครื่องพัฒนา
- [deployment-guide.md](deployment-guide.md) รายละเอียดเชิงเทคนิค
- [architecture.md](architecture.md) สถาปัตยกรรม
- [api-documentation.md](api-documentation.md) รายการ API

## แหล่งข้อมูลทางการ

ตรวจเมื่อ 5 พ.ย. 2569 ค่าและเงื่อนไขอาจเปลี่ยนได้

- [Vercel: Setting up a custom domain](https://vercel.com/docs/domains/set-up-custom-domain)
- [Vercel: Using Monorepos](https://vercel.com/docs/monorepos)
- [Vercel: Hobby Plan](https://vercel.com/docs/plans/hobby) และ [Fair Use Guidelines](https://vercel.com/docs/limits/fair-use-guidelines)
- [Vercel: Configuring regions](https://vercel.com/docs/functions/configuring-functions/region)
- [Supabase: Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase: Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)
- [Expo: eas.json](https://docs.expo.dev/eas/json/)
