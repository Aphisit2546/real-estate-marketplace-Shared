# API Documentation

Base URL: `/api/v1` Schema ทุกตัวอยู่ใน [packages/shared/src/schemas.ts](../packages/shared/src/schemas.ts) และ Response Type อยู่ใน [types.ts](../packages/shared/src/types.ts)

## หลักการร่วม

**Authentication:** `Authorization: Bearer <access token>`

**Response**

```json
{ "data": { }, "meta": { } }
```

**Error**

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "รหัสผ่านต้องมีตัวเลข", "details": [{ "path": "password", "message": "..." }] } }
```

| Status | ความหมาย |
|---|---|
| 200, 201, 204 | สำเร็จ |
| 401 | ไม่มี Token หรือ Token ใช้ไม่ได้ Client ควร Refresh แล้วลองใหม่ |
| 403 | ไม่มีสิทธิ์ หรือบัญชีถูกระงับ (`ACCOUNT_SUSPENDED`) |
| 404 | ไม่พบ หรือไม่มีสิทธิ์เห็น ใช้ 404 เพื่อไม่บอกว่าข้อมูลมีอยู่ |
| 409 | สถานะไม่อนุญาต หรือข้อมูลซ้ำ |
| 422 | ข้อมูลไม่ถูกต้อง |
| 429 | ถี่เกินกำหนด |

**Pagination:** รายการทั่วไปใช้ `?page=&limit=` และ `meta: { page, limit, total, totalPages }` ส่วนการค้นหาใช้ Cursor `meta: { nextCursor, limit }` จำกัด `limit` สูงสุด 50

สิทธิ์ในตาราง: **P** สาธารณะ, **O** ไม่บังคับล็อกอิน, **U** สมาชิก, **L** ผู้ประกาศ, **A** ผู้ดูแล

## Authentication

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| POST | `/auth/register` | P | 5 ครั้งต่อชั่วโมงต่อ IP ตอบเหมือนกันแม้อีเมลซ้ำ |
| POST | `/auth/login` | P | 10 ครั้งต่อ 15 นาทีต่อ IP |
| POST | `/auth/refresh` | P | Refresh Token ใช้ได้ครั้งเดียว |
| POST | `/auth/logout` | U | |
| GET | `/auth/me` | U | |
| POST | `/auth/forgot-password` | P | ตอบสำเร็จเสมอ |
| POST | `/auth/resend-verification` | P | |
| POST | `/auth/reset-password` | U | ใช้ Token จากลิงก์ในอีเมล |
| GET | `/auth/oauth?provider=google&redirectTo=` | P | คืน URL สำหรับ Redirect |

```http
POST /api/v1/auth/login
{ "email": "somchai@example.com", "password": "Password123" }

200 { "data": { "session": { "accessToken": "...", "refreshToken": "...", "expiresAt": 1793858400 } } }
```

## Users

| Method | Path | สิทธิ์ |
|---|---|---|
| GET, PATCH | `/users/me` | U |
| POST | `/users/me/avatar` (multipart `file`) | U |
| POST | `/users/me/become-lister` `{ role: owner \| agent }` | U |
| POST | `/users/me/password` | U |
| POST | `/users/me/deactivate` `{ confirm: "ปิดบัญชี" }` | U |
| POST, DELETE | `/users/me/push-tokens` | U |
| GET | `/users/me/listings?status=&page=` | L |
| GET, DELETE | `/users/me/search-history` | U |

## Catalog

| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/categories` | P |
| GET | `/amenities` | P |
| GET | `/locations?level=&parentId=` | P |
| GET | `/settings` | P |
| GET | `/properties?q=` | P |

## Listings

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/listings` | O | ค้นหา |
| POST | `/listings` | L | สร้างเป็น `draft` เสมอ 20 ครั้งต่อชั่วโมง |
| GET | `/listings/:id` | O | เบอร์โทรส่งให้เฉพาะผู้ที่ล็อกอิน |
| PATCH | `/listings/:id` | L เจ้าของ | แก้ข้อมูลสำคัญบนประกาศที่เผยแพร่จะกลับไปรอตรวจสอบ |
| DELETE | `/listings/:id` | L เจ้าของ | เปลี่ยนเป็น `archived` |
| POST | `/listings/:id/submit-review` | L เจ้าของ | ต้องมีรูปอย่างน้อย 1 รูป |
| POST | `/listings/:id/pause` | L เจ้าของ | |
| POST | `/listings/:id/status` `{ status }` | L เจ้าของ | `rented`, `sold`, `published`, `draft` |
| GET | `/listings/:id/stats` | L เจ้าของ | |
| POST | `/listings/:id/view` | P | นับยอดเข้าชม |
| POST, DELETE | `/listings/:id/favorite` | U | |
| POST | `/listings/:id/images` (multipart `file`) | L เจ้าของ | ไม่เกิน 4 MB |
| PATCH | `/listings/:id/images` `{ imageIds }` | L เจ้าของ | เรียงลำดับ ต้องส่งครบทุกรูป |
| DELETE | `/listings/:id/images/:imageId` | L เจ้าของ | |
| POST | `/listings/:id/images/:imageId/cover` | L เจ้าของ | |
| GET | `/favorites` | U | |
| GET, POST | `/saved-searches` | U | |
| DELETE | `/saved-searches/:id` | U | |

**พารามิเตอร์การค้นหา:** `q`, `purpose`, `category`, `provinceId`, `districtId`, `subdistrictId`, `propertyId`, `minPrice`, `maxPrice`, `minArea`, `maxArea`, `bedrooms`, `bathrooms`, `furnishing`, `amenities` (คั่นด้วยจุลภาค), `availableNow`, `bbox` (`minLat,minLng,maxLat,maxLng`), `sort` (`newest`, `price_asc`, `price_desc`, `relevance`), `cursor`, `limit`

```http
GET /api/v1/listings?q=อโศก&purpose=rent&maxPrice=20000&sort=price_asc

200 { "data": [ { "id": "...", "title": "...", "monthlyRent": 18000, "areaSqm": 35, "coverUrl": "..." } ],
      "meta": { "nextCursor": "WyIxODAwMCIsIi4uLiJd", "limit": 20 } }
```

```http
POST /api/v1/listings
{ "categoryId": 1, "purpose": "rent", "monthlyRent": 18000, "title": "คอนโดใกล้ BTS",
  "description": "ห้องสวย เฟอร์นิเจอร์ครบ พร้อมเข้าอยู่", "contactName": "สมชาย",
  "property": { "nameTh": "อาคารตัวอย่าง", "address": "1 ถนนสุขุมวิท", "provinceId": 1, "districtId": 116 },
  "unit": { "areaSqm": 35, "bedrooms": 1, "bathrooms": 1 } }

201 { "data": { "id": "...", "status": "draft" } }
```

ใส่ `propertyId` แทน `property` เพื่อผูกกับโครงการที่มีอยู่แล้ว

## Messaging

| Method | Path | สิทธิ์ | หมายเหตุ |
|---|---|---|---|
| GET | `/conversations` | U | |
| POST | `/conversations` `{ listingId, message }` | U | ใช้บทสนทนาเดิมถ้ามีอยู่แล้ว |
| GET | `/conversations/:id/messages?before=&limit=` | U ผู้ร่วมสนทนา | |
| POST | `/conversations/:id/messages` `{ body }` | U ผู้ร่วมสนทนา | 60 ครั้งต่อนาที |
| POST | `/conversations/:id/read` | U ผู้ร่วมสนทนา | |
| POST, DELETE | `/blocks` `{ userId }` | U | |

## Appointments

| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/appointments` | U |
| POST | `/appointments` `{ listingId, scheduledAt, note }` | U |
| PATCH | `/appointments/:id` `{ action, scheduledAt? }` | U คู่นัด |

`action`: `confirm`, `reject`, `complete` (เจ้าของเท่านั้น), `reschedule`, `cancel` (ทั้งสองฝ่าย), `accept_reschedule` (ฝ่ายที่ไม่ได้เสนอ)

## Notifications, Reports, Verification

| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/notifications` | U |
| POST | `/notifications/read-all` | U |
| POST | `/notifications/:id/read` | U |
| POST | `/reports` | U |
| GET | `/verification-requests` | U |
| POST | `/verification-requests` (multipart `type`, `files`, `note`) | U |

## Admin

ทุก Endpoint ต้องมีบทบาท `admin` การเปลี่ยนแปลงทุกอย่างบันทึกใน Audit Log

| Method | Path |
|---|---|
| GET | `/admin/dashboard` |
| GET | `/admin/listings?status=&q=&page=` |
| GET | `/admin/listings/pending` |
| POST | `/admin/listings/:id/approve` |
| POST | `/admin/listings/:id/reject` `{ reason }` ใช้ระงับประกาศที่เผยแพร่แล้วด้วย |
| GET | `/admin/users?q=&status=&role=&page=` |
| PATCH | `/admin/users/:id/status` `{ status, reason }` |
| POST | `/admin/users/:id/roles` `{ role, action: grant \| revoke }` |
| GET | `/admin/reports?status=&page=` |
| PATCH | `/admin/reports/:id` `{ status, note }` |
| GET | `/admin/audit-logs?action=&actorId=&page=` |
| GET | `/admin/verification-requests` |
| PATCH | `/admin/verification-requests/:id` `{ status, note }` |
| GET | `/admin/settings` |
| PATCH | `/admin/settings/:key` `{ value }` |
| GET, POST | `/admin/categories` |
| PATCH | `/admin/categories/:id` |
| GET, POST | `/admin/amenities` |
| PATCH | `/admin/amenities/:id` |

## ระบบ

| Method | Path | สิทธิ์ |
|---|---|---|
| GET | `/health` | P |
| GET, POST | `/internal/expire` | `Authorization: Bearer $CRON_SECRET` |
