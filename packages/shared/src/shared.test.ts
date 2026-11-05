import { describe, expect, it } from 'vitest';
import {
  canTransitionListing, createListingSchema, formatBaht, formatListingPrice, formatThaiDate, formatThaiDateTime,
  hasMaterialChange, nextAppointmentStatus, nextOwnerStatuses, passwordSchema, searchQuery, updateAppointmentSchema,
} from './index';

const baseListing = {
  categoryId: 1,
  title: 'คอนโดใกล้รถไฟฟ้า',
  description: 'ห้องสวย ตกแต่งครบ พร้อมเข้าอยู่ได้ทันที ใกล้ BTS',
  contactName: 'สมชาย',
  propertyId: '6f1d3b0e-8a4b-4f7e-9c3d-2b1a0e9d8c7b',
  unit: { areaSqm: 35 },
};

describe('money and dates', () => {
  it('formats Thai baht', () => {
    expect(formatBaht(2500000)).toBe('฿2,500,000');
  });

  it('labels rent per month and per day', () => {
    expect(formatListingPrice({ purpose: 'rent', salePrice: null, monthlyRent: 12000, dailyRent: null })).toBe('฿12,000/เดือน');
    expect(formatListingPrice({ purpose: 'rent', salePrice: null, monthlyRent: null, dailyRent: 900 })).toBe('฿900/วัน');
    expect(formatListingPrice({ purpose: 'sale', salePrice: 2500000, monthlyRent: null, dailyRent: null })).toBe('฿2,500,000');
  });

  it('formats dates in the Buddhist Era on Bangkok time', () => {
    expect(formatThaiDate('2026-11-05T00:00:00Z')).toBe('5 พ.ย. 2569');
    // 18:00 UTC is already the next day in Bangkok.
    expect(formatThaiDate('2026-11-05T18:00:00Z')).toBe('6 พ.ย. 2569');
    expect(formatThaiDateTime('2026-11-05T07:30:00Z')).toBe('5 พ.ย. 2569 14:30 น.');
  });
});

describe('listing workflow', () => {
  it('lets the owner submit but only the system publish', () => {
    expect(canTransitionListing('draft', 'pending_review', 'owner')).toBe(true);
    expect(canTransitionListing('pending_review', 'published', 'owner')).toBe(false);
    expect(canTransitionListing('pending_review', 'published', 'system')).toBe(true);
  });

  it('rejects jumps that skip review', () => {
    expect(canTransitionListing('draft', 'published', 'system')).toBe(false);
    expect(canTransitionListing('archived', 'published', 'system')).toBe(false);
  });

  it('offers sensible next steps', () => {
    expect(nextOwnerStatuses('published')).toEqual(['pending_review', 'paused', 'rented', 'sold', 'archived']);
    expect(nextOwnerStatuses('archived')).toEqual([]);
  });

  it('detects material edits only when a value really changes', () => {
    expect(hasMaterialChange({ title: 'เดิม' }, { title: 'ใหม่' })).toBe(true);
    expect(hasMaterialChange({ title: 'เดิม' }, { title: 'เดิม' })).toBe(false);
    expect(hasMaterialChange({ title: 'เดิม', deposit: 1 }, { deposit: 2 })).toBe(false);
  });
});

describe('appointment workflow', () => {
  const base = { proposedByOtherParty: false } as const;

  it('only lets the owner confirm a request', () => {
    expect(nextAppointmentStatus({ ...base, status: 'requested', action: 'confirm', party: 'owner' })).toBe('confirmed');
    expect(nextAppointmentStatus({ ...base, status: 'requested', action: 'confirm', party: 'requester' })).toBeNull();
  });

  it('never lets you accept your own reschedule proposal', () => {
    expect(nextAppointmentStatus({ status: 'reschedule_requested', action: 'accept_reschedule', party: 'owner', proposedByOtherParty: false })).toBeNull();
    expect(nextAppointmentStatus({ status: 'reschedule_requested', action: 'accept_reschedule', party: 'owner', proposedByOtherParty: true })).toBe('confirmed');
  });

  it('does not reopen a cancelled appointment', () => {
    expect(nextAppointmentStatus({ ...base, status: 'cancelled', action: 'reschedule', party: 'owner' })).toBeNull();
  });
});

describe('validation', () => {
  it('accepts a valid sale listing', () => {
    expect(createListingSchema.safeParse({ ...baseListing, purpose: 'sale', salePrice: 2500000 }).success).toBe(true);
  });

  it('requires a sale price on a sale listing', () => {
    expect(createListingSchema.safeParse({ ...baseListing, purpose: 'sale' }).success).toBe(false);
  });

  it('refuses rent fields on a sale listing', () => {
    const result = createListingSchema.safeParse({ ...baseListing, purpose: 'sale', salePrice: 100, monthlyRent: 100 });
    expect(result.success).toBe(false);
  });

  it('requires either a monthly or daily price on a rent listing', () => {
    expect(createListingSchema.safeParse({ ...baseListing, purpose: 'rent' }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...baseListing, purpose: 'rent', dailyRent: 900 }).success).toBe(true);
  });

  it('refuses a negative price', () => {
    expect(createListingSchema.safeParse({ ...baseListing, purpose: 'rent', monthlyRent: -5 }).success).toBe(false);
  });

  it('requires a property reference', () => {
    const { propertyId: _ignored, ...rest } = baseListing;
    expect(createListingSchema.safeParse({ ...rest, purpose: 'rent', monthlyRent: 100 }).success).toBe(false);
  });

  it('refuses coordinates outside Thailand and half a coordinate pair', () => {
    const property = { nameTh: 'บ้าน', address: 'กรุงเทพ', provinceId: 1, districtId: 2 };
    const input = { ...baseListing, propertyId: undefined, purpose: 'rent', monthlyRent: 100 };
    expect(createListingSchema.safeParse({ ...input, property: { ...property, lat: 51.5, lng: -0.1 } }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...input, property: { ...property, lat: 13.7 } }).success).toBe(false);
    expect(createListingSchema.safeParse({ ...input, property: { ...property, lat: 13.7, lng: 100.5 } }).success).toBe(true);
  });

  it('enforces password strength', () => {
    expect(passwordSchema.safeParse('short1').success).toBe(false);
    expect(passwordSchema.safeParse('onlyletters').success).toBe(false);
    expect(passwordSchema.safeParse('goodpass123').success).toBe(true);
  });

  it('parses search query strings', () => {
    const parsed = searchQuery.parse({ q: ' อโศก ', minPrice: '1000', amenities: '1,2', availableNow: 'true', purpose: '' });
    expect(parsed).toMatchObject({ q: 'อโศก', minPrice: 1000, amenities: [1, 2], availableNow: true, sort: 'newest', limit: 20 });
    expect(parsed.purpose).toBeUndefined();
  });

  it('caps page size', () => {
    expect(searchQuery.safeParse({ limit: '500' }).success).toBe(false);
  });

  it('refuses appointments in the past', () => {
    const result = updateAppointmentSchema.safeParse({ action: 'reschedule', scheduledAt: '2020-01-01T00:00:00Z' });
    expect(result.success).toBe(false);
  });
});
