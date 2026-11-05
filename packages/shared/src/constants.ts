export const APP_ROLES = ['member', 'owner', 'agent', 'admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const LISTING_STATUSES = [
  'draft', 'pending_review', 'published', 'rejected', 'paused', 'rented', 'sold', 'expired', 'archived',
] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_PURPOSES = ['sale', 'rent'] as const;
export type ListingPurpose = (typeof LISTING_PURPOSES)[number];

export const PROPERTY_KINDS = ['project', 'building', 'standalone'] as const;
export type PropertyKind = (typeof PROPERTY_KINDS)[number];

export const FURNISHING_LEVELS = ['unfurnished', 'partial', 'full'] as const;
export type FurnishingLevel = (typeof FURNISHING_LEVELS)[number];

export const PET_POLICIES = ['not_allowed', 'allowed', 'negotiable'] as const;
export type PetPolicy = (typeof PET_POLICIES)[number];

export const APPOINTMENT_STATUSES = [
  'requested', 'confirmed', 'rejected', 'reschedule_requested', 'cancelled', 'completed',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const REPORT_REASONS = ['fraud', 'duplicate', 'wrong_info', 'inappropriate', 'unavailable', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const VERIFICATION_TYPES = ['identity', 'ownership', 'agent_license'] as const;
export type VerificationType = (typeof VERIFICATION_TYPES)[number];

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const SEARCH_SORTS = ['newest', 'price_asc', 'price_desc', 'relevance'] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const BRAND_NAME = 'HONGMUNG';
export const BRAND_NAME_TH = 'ห้องมึง';
export const BRAND_TAGLINE = 'ห้องใครก็หา ห้องเราก็เลือก';
export const BRAND_COLOR = '#6C3BFF';

export const LIMITS = {
  imageMaxBytes: 4 * 1024 * 1024,
  documentMaxBytes: 4 * 1024 * 1024,
  avatarMaxBytes: 2 * 1024 * 1024,
  acceptedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  defaultPageSize: 20,
  maxPageSize: 50,
} as const;

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  draft: 'ฉบับร่าง',
  pending_review: 'รอตรวจสอบ',
  published: 'เผยแพร่แล้ว',
  rejected: 'ไม่ผ่านการตรวจสอบ',
  paused: 'หยุดชั่วคราว',
  rented: 'ปล่อยเช่าแล้ว',
  sold: 'ขายแล้ว',
  expired: 'หมดอายุ',
  archived: 'เก็บถาวร',
};

export const PURPOSE_LABELS: Record<ListingPurpose, string> = { sale: 'ขาย', rent: 'เช่า' };

export const FURNISHING_LABELS: Record<FurnishingLevel, string> = {
  unfurnished: 'ไม่มีเฟอร์นิเจอร์',
  partial: 'เฟอร์นิเจอร์บางส่วน',
  full: 'เฟอร์นิเจอร์ครบ',
};

export const PET_POLICY_LABELS: Record<PetPolicy, string> = {
  not_allowed: 'ไม่อนุญาตสัตว์เลี้ยง',
  allowed: 'เลี้ยงสัตว์ได้',
  negotiable: 'สอบถามเรื่องสัตว์เลี้ยง',
};

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: 'รอยืนยัน',
  confirmed: 'ยืนยันแล้ว',
  rejected: 'ปฏิเสธ',
  reschedule_requested: 'ขอเปลี่ยนเวลา',
  cancelled: 'ยกเลิก',
  completed: 'เสร็จสิ้น',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  fraud: 'น่าสงสัยว่าหลอกลวง',
  duplicate: 'ประกาศซ้ำ',
  wrong_info: 'ข้อมูลไม่ถูกต้อง',
  inappropriate: 'เนื้อหาไม่เหมาะสม',
  unavailable: 'ทรัพย์ไม่ว่างแล้ว',
  other: 'อื่น ๆ',
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'รอดำเนินการ',
  reviewing: 'กำลังตรวจสอบ',
  resolved: 'ดำเนินการแล้ว',
  dismissed: 'ไม่พบปัญหา',
};

export const ROLE_LABELS: Record<AppRole, string> = {
  member: 'สมาชิก',
  owner: 'เจ้าของทรัพย์',
  agent: 'นายหน้า',
  admin: 'ผู้ดูแลระบบ',
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'ใช้งานอยู่',
  suspended: 'ถูกระงับ',
  deactivated: 'ปิดบัญชีแล้ว',
};

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  identity: 'ยืนยันตัวตน',
  ownership: 'ยืนยันกรรมสิทธิ์',
  agent_license: 'ใบอนุญาตนายหน้า',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  pending: 'รอตรวจสอบ',
  approved: 'อนุมัติแล้ว',
  rejected: 'ไม่อนุมัติ',
};

export const SEARCH_SORT_LABELS: Record<SearchSort, string> = {
  newest: 'ลงประกาศล่าสุด',
  price_asc: 'ราคาต่ำไปสูง',
  price_desc: 'ราคาสูงไปต่ำ',
  relevance: 'เกี่ยวข้องที่สุด',
};
