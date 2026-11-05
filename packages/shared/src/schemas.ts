import { z } from 'zod';
import {
  APP_ROLES, FURNISHING_LEVELS, LIMITS, LISTING_PURPOSES, LISTING_STATUSES, PET_POLICIES, REPORT_REASONS,
  REPORT_STATUSES, SEARCH_SORTS, USER_STATUSES, VERIFICATION_TYPES,
} from './constants';

const trimmed = (min: number, max: number, label: string) =>
  z.string().trim()
    .min(min, `${label}ต้องมีอย่างน้อย ${min} ตัวอักษร`)
    .max(max, `${label}ต้องไม่เกิน ${max} ตัวอักษร`);

const emptyToUndefined = (value: unknown) => (value === '' || value === null ? undefined : value);
const optionalOf = <T extends z.ZodType>(schema: T) => z.preprocess(emptyToUndefined, schema.optional());

const money = (max: number) => z.coerce.number().int('กรุณากรอกจำนวนเต็ม').positive('ต้องมากกว่า 0').max(max, 'จำนวนเงินสูงเกินไป');
const nonNegativeMoney = z.coerce.number().int('กรุณากรอกจำนวนเต็ม').min(0, 'ต้องไม่ติดลบ').max(1_000_000_000);
const phone = z.string().trim().regex(/^\+?[0-9]{9,15}$/, 'รูปแบบเบอร์โทรไม่ถูกต้อง');
const httpsUrl = z.string().trim().url('URL ไม่ถูกต้อง').startsWith('https://', 'ต้องขึ้นต้นด้วย https://');
const booleanParam = z.preprocess((value) => (value === 'true' ? true : value === 'false' ? false : value), z.boolean());

export const idParam = z.object({ id: z.string().uuid('รหัสไม่ถูกต้อง') });
export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(LIMITS.maxPageSize).default(LIMITS.defaultPageSize),
});

// ---------------------------------------------------------------- auth
export const passwordSchema = z.string()
  .min(8, 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร')
  .max(72, 'รหัสผ่านต้องไม่เกิน 72 ตัวอักษร')
  .regex(/[A-Za-z]/, 'รหัสผ่านต้องมีตัวอักษร')
  .regex(/[0-9]/, 'รหัสผ่านต้องมีตัวเลข');

export const emailSchema = z.string().trim().toLowerCase().email('อีเมลไม่ถูกต้อง').max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: trimmed(1, 100, 'ชื่อที่แสดง'),
  redirectTo: z.string().url().optional(),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, 'กรุณากรอกรหัสผ่าน').max(72) });
export const refreshSchema = z.object({ refreshToken: z.string().min(1) });
export const forgotPasswordSchema = z.object({ email: emailSchema, redirectTo: z.string().url().optional() });
export const resetPasswordSchema = z.object({ password: passwordSchema });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(72), newPassword: passwordSchema });
export const deactivateSchema = z.object({ password: z.string().min(1).max(72).optional(), confirm: z.literal('ปิดบัญชี') });
export const oauthQuery = z.object({ provider: z.enum(['google']), redirectTo: z.string().url() });

// ---------------------------------------------------------------- profile
export const updateProfileSchema = z.object({
  displayName: trimmed(1, 100, 'ชื่อที่แสดง').optional(),
  phone: z.union([phone, z.literal(''), z.null()]).optional(),
  lineId: z.string().trim().max(50).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
});
export const becomeListerSchema = z.object({ role: z.enum(['owner', 'agent']) });
export const pushTokenSchema = z.object({ token: z.string().min(10).max(255), platform: z.enum(['ios', 'android']) });

// ---------------------------------------------------------------- listing
const propertyInput = z.object({
  kind: z.enum(['project', 'building', 'standalone']).default('standalone'),
  nameTh: trimmed(1, 200, 'ชื่อโครงการหรืออาคาร'),
  nameEn: optionalOf(z.string().trim().max(200)),
  address: trimmed(1, 500, 'ที่อยู่'),
  provinceId: z.coerce.number().int().positive('กรุณาเลือกจังหวัด'),
  districtId: z.coerce.number().int().positive('กรุณาเลือกเขตหรืออำเภอ'),
  subdistrictId: optionalOf(z.coerce.number().int().positive()),
  postalCode: optionalOf(z.string().trim().regex(/^[0-9]{5}$/, 'รหัสไปรษณีย์ต้องมี 5 หลัก')),
  lat: optionalOf(z.coerce.number().min(5, 'พิกัดต้องอยู่ในประเทศไทย').max(21, 'พิกัดต้องอยู่ในประเทศไทย')),
  lng: optionalOf(z.coerce.number().min(97, 'พิกัดต้องอยู่ในประเทศไทย').max(106, 'พิกัดต้องอยู่ในประเทศไทย')),
  totalFloors: optionalOf(z.coerce.number().int().min(1).max(200)),
  yearBuilt: optionalOf(z.coerce.number().int().min(1900).max(2100)),
}).refine((value) => (value.lat === undefined) === (value.lng === undefined), {
  message: 'กรุณากรอกพิกัดให้ครบทั้งละติจูดและลองจิจูด',
  path: ['lat'],
});

const unitInput = z.object({
  unitNumber: optionalOf(z.string().trim().min(1).max(50)),
  floor: optionalOf(z.coerce.number().int().min(-5).max(200)),
  areaSqm: z.coerce.number().positive('ขนาดพื้นที่ต้องมากกว่า 0').max(99999),
  bedrooms: z.coerce.number().int().min(0).max(50).default(0),
  bathrooms: z.coerce.number().int().min(0).max(50).default(1),
  parkingSpaces: z.coerce.number().int().min(0).max(50).default(0),
  furnishing: z.enum(FURNISHING_LEVELS).default('unfurnished'),
  appliances: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
});

const listingContent = z.object({
  categoryId: z.coerce.number().int().positive('กรุณาเลือกประเภท'),
  title: trimmed(5, 200, 'ชื่อประกาศ'),
  description: trimmed(20, 10000, 'รายละเอียด'),
  deposit: optionalOf(nonNegativeMoney),
  bookingFee: optionalOf(nonNegativeMoney),
  additionalTerms: optionalOf(z.string().trim().max(5000)),
  rentalTerms: optionalOf(z.string().trim().max(5000)),
  minLeaseMonths: optionalOf(z.coerce.number().int().min(1).max(120)),
  petPolicy: z.enum(PET_POLICIES).default('not_allowed'),
  availableFrom: optionalOf(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง')),
  contactName: trimmed(1, 100, 'ชื่อผู้ติดต่อ'),
  contactPhone: optionalOf(phone),
  contactLine: optionalOf(z.string().trim().max(50)),
  videoUrl: optionalOf(httpsUrl),
  virtualTourUrl: optionalOf(httpsUrl),
  amenityIds: z.array(z.coerce.number().int().positive()).max(50).default([]),
});

const pricing = z.object({
  purpose: z.enum(LISTING_PURPOSES),
  salePrice: optionalOf(money(100_000_000_000)),
  monthlyRent: optionalOf(money(100_000_000)),
  dailyRent: optionalOf(money(10_000_000)),
});

type PricingValue = z.infer<typeof pricing>;

function checkPricing(value: PricingValue, ctx: z.RefinementCtx) {
  if (value.purpose === 'sale') {
    if (value.salePrice === undefined) {
      ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'กรุณากรอกราคาขาย' });
    }
    if (value.monthlyRent !== undefined || value.dailyRent !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'ประกาศขายต้องไม่มีราคาเช่า' });
    }
  } else {
    if (value.monthlyRent === undefined && value.dailyRent === undefined) {
      ctx.addIssue({ code: 'custom', path: ['monthlyRent'], message: 'กรุณากรอกค่าเช่า' });
    }
    if (value.salePrice !== undefined) {
      ctx.addIssue({ code: 'custom', path: ['salePrice'], message: 'ประกาศเช่าต้องไม่มีราคาขาย' });
    }
  }
}

export const createListingSchema = listingContent.extend(pricing.shape).extend({
  propertyId: optionalOf(z.string().uuid()),
  property: propertyInput.optional(),
  unit: unitInput,
}).superRefine((value, ctx) => {
  checkPricing(value, ctx);
  if (!value.propertyId && !value.property) {
    ctx.addIssue({ code: 'custom', path: ['property'], message: 'กรุณาระบุโครงการหรือที่อยู่' });
  }
});

/** In a PATCH: missing leaves the value alone, while '' or null clears it. */
const clearable = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === '' ? null : value), schema.nullable().optional());

export const updateListingSchema = listingContent.partial().extend({
  salePrice: optionalOf(money(100_000_000_000)),
  monthlyRent: clearable(money(100_000_000)),
  dailyRent: clearable(money(10_000_000)),
  deposit: clearable(nonNegativeMoney),
  bookingFee: clearable(nonNegativeMoney),
  additionalTerms: clearable(z.string().trim().max(5000)),
  rentalTerms: clearable(z.string().trim().max(5000)),
  minLeaseMonths: clearable(z.coerce.number().int().min(1).max(120)),
  availableFrom: clearable(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'วันที่ไม่ถูกต้อง')),
  contactPhone: clearable(phone),
  contactLine: clearable(z.string().trim().max(50)),
  videoUrl: clearable(httpsUrl),
  virtualTourUrl: clearable(httpsUrl),
  petPolicy: z.enum(PET_POLICIES).optional(),
  amenityIds: z.array(z.coerce.number().int().positive()).max(50).optional(),
  unit: z.object({
    unitNumber: clearable(z.string().trim().min(1).max(50)),
    floor: clearable(z.coerce.number().int().min(-5).max(200)),
    areaSqm: z.coerce.number().positive().max(99999).optional(),
    bedrooms: z.coerce.number().int().min(0).max(50).optional(),
    bathrooms: z.coerce.number().int().min(0).max(50).optional(),
    parkingSpaces: z.coerce.number().int().min(0).max(50).optional(),
    furnishing: z.enum(FURNISHING_LEVELS).optional(),
    appliances: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
  }).optional(),
});

export const listingStatusActionSchema = z.object({ status: z.enum(['rented', 'sold', 'published', 'draft']) });
export const reorderImagesSchema = z.object({ imageIds: z.array(z.string().uuid()).min(1).max(100) });

// ---------------------------------------------------------------- search
const csvNumbers = z.preprocess(
  (value) => (typeof value === 'string' && value.length > 0 ? value.split(',') : value === '' ? undefined : value),
  z.array(z.coerce.number().int().positive()).max(20).optional(),
);

const bboxParam = z.preprocess(
  (value) => (typeof value === 'string' && value.length > 0 ? value.split(',').map(Number) : undefined),
  z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
);

export const searchQuery = z.object({
  q: optionalOf(z.string().trim().max(100)),
  purpose: optionalOf(z.enum(LISTING_PURPOSES)),
  category: optionalOf(z.string().trim().regex(/^[a-z0-9_]+$/)),
  provinceId: optionalOf(z.coerce.number().int().positive()),
  districtId: optionalOf(z.coerce.number().int().positive()),
  subdistrictId: optionalOf(z.coerce.number().int().positive()),
  propertyId: optionalOf(z.string().uuid()),
  minPrice: optionalOf(z.coerce.number().int().min(0)),
  maxPrice: optionalOf(z.coerce.number().int().min(0)),
  minArea: optionalOf(z.coerce.number().min(0)),
  maxArea: optionalOf(z.coerce.number().min(0)),
  bedrooms: optionalOf(z.coerce.number().int().min(0).max(50)),
  bathrooms: optionalOf(z.coerce.number().int().min(0).max(50)),
  furnishing: optionalOf(z.enum(FURNISHING_LEVELS)),
  amenities: csvNumbers,
  availableNow: optionalOf(booleanParam),
  bbox: bboxParam,
  sort: z.preprocess(emptyToUndefined, z.enum(SEARCH_SORTS).default('newest')),
  cursor: optionalOf(z.string().max(500)),
  limit: z.coerce.number().int().min(1).max(LIMITS.maxPageSize).default(LIMITS.defaultPageSize),
});
export type SearchQuery = z.infer<typeof searchQuery>;

export const saveSearchSchema = z.object({
  name: trimmed(1, 100, 'ชื่อการค้นหา'),
  criteria: z.record(z.string(), z.unknown()),
});

export const locationsQuery = z.object({
  level: z.enum(['province', 'district', 'subdistrict']).default('province'),
  parentId: optionalOf(z.coerce.number().int().positive()),
});

export const propertySearchQuery = z.object({ q: z.string().trim().min(1).max(100) });

// ---------------------------------------------------------------- messaging
export const startConversationSchema = z.object({
  listingId: z.string().uuid(),
  message: trimmed(1, 4000, 'ข้อความ'),
});
export const sendMessageSchema = z.object({
  body: trimmed(1, 4000, 'ข้อความ'),
  refListingId: optionalOf(z.string().uuid()),
});
export const messagesQuery = z.object({
  before: optionalOf(z.string().datetime({ offset: true })),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const blockUserSchema = z.object({ userId: z.string().uuid() });

// ---------------------------------------------------------------- appointments
const futureDate = z.string().datetime({ offset: true, message: 'วันเวลาไม่ถูกต้อง' })
  .refine((value) => new Date(value).getTime() > Date.now(), 'กรุณาเลือกเวลาในอนาคต');

export const createAppointmentSchema = z.object({
  listingId: z.string().uuid(),
  scheduledAt: futureDate,
  note: optionalOf(z.string().trim().max(1000)),
});
export const updateAppointmentSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('confirm') }),
  z.object({ action: z.literal('reject') }),
  z.object({ action: z.literal('cancel') }),
  z.object({ action: z.literal('complete') }),
  z.object({ action: z.literal('accept_reschedule') }),
  z.object({ action: z.literal('reschedule'), scheduledAt: futureDate }),
]);

// ---------------------------------------------------------------- trust & safety
export const createReportSchema = z.object({
  listingId: optionalOf(z.string().uuid()),
  reportedUserId: optionalOf(z.string().uuid()),
  reason: z.enum(REPORT_REASONS),
  details: optionalOf(z.string().trim().max(2000)),
}).refine((value) => value.listingId || value.reportedUserId, {
  message: 'กรุณาระบุประกาศหรือผู้ใช้ที่ต้องการรายงาน',
  path: ['listingId'],
});

export const verificationTypeSchema = z.enum(VERIFICATION_TYPES);

// ---------------------------------------------------------------- admin
export const rejectListingSchema = z.object({ reason: trimmed(5, 1000, 'เหตุผล') });
export const adminUsersQuery = pageQuery.extend({
  q: optionalOf(z.string().trim().max(100)),
  status: optionalOf(z.enum(USER_STATUSES)),
  role: optionalOf(z.enum(APP_ROLES)),
});
export const adminListingsQuery = pageQuery.extend({
  q: optionalOf(z.string().trim().max(100)),
  status: optionalOf(z.enum(LISTING_STATUSES)),
});
export const adminUserStatusSchema = z.object({
  status: z.enum(['active', 'suspended']),
  reason: optionalOf(z.string().trim().max(500)),
});
export const adminUserRoleSchema = z.object({ role: z.enum(APP_ROLES), action: z.enum(['grant', 'revoke']) });
export const adminReportsQuery = pageQuery.extend({ status: optionalOf(z.enum(REPORT_STATUSES)) });
export const adminResolveReportSchema = z.object({
  status: z.enum(['reviewing', 'resolved', 'dismissed']),
  note: optionalOf(z.string().trim().max(2000)),
});
export const adminAuditQuery = pageQuery.extend({
  action: optionalOf(z.string().trim().max(100)),
  actorId: optionalOf(z.string().uuid()),
});
export const adminReviewVerificationSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  note: optionalOf(z.string().trim().max(1000)),
});
export const adminSettingSchema = z.object({ value: z.union([z.boolean(), z.number(), z.string()]) });
const refName = { nameTh: trimmed(1, 100, 'ชื่อภาษาไทย'), nameEn: trimmed(1, 100, 'ชื่อภาษาอังกฤษ') };
export const adminCategorySchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9_]+$/, 'ใช้ได้เฉพาะ a-z 0-9 และ _'),
  ...refName,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export const adminAmenitySchema = z.object({
  code: z.string().trim().regex(/^[a-z0-9_]+$/, 'ใช้ได้เฉพาะ a-z 0-9 และ _'),
  scope: z.enum(['building', 'unit']),
  ...refName,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export const numericIdParam = z.object({ id: z.coerce.number().int().positive() });
export const settingKeyParam = z.object({ key: z.string().regex(/^[a-z0-9_]+$/) });
export const imageParams = z.object({ id: z.string().uuid(), imageId: z.string().uuid() });

export type CreateListingInput = z.input<typeof createListingSchema>;
export type UpdateListingInput = z.input<typeof updateListingSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
