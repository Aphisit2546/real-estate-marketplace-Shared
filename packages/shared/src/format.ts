import type { ListingPurpose } from './constants';

const bahtFormatter = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 0 });

/** 2500000 -> ฿2,500,000 */
export function formatBaht(amount: number): string {
  return `฿${bahtFormatter.format(amount)}`;
}

export function formatListingPrice(listing: {
  purpose: ListingPurpose;
  salePrice: number | null;
  monthlyRent: number | null;
  dailyRent: number | null;
}): string {
  if (listing.purpose === 'sale') {
    return listing.salePrice === null ? 'สอบถามราคา' : formatBaht(listing.salePrice);
  }
  if (listing.monthlyRent !== null) return `${formatBaht(listing.monthlyRent)}/เดือน`;
  if (listing.dailyRent !== null) return `${formatBaht(listing.dailyRent)}/วัน`;
  return 'สอบถามราคา';
}

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Shifts to Bangkok wall-clock time so output does not depend on the device's time zone. */
function toBangkok(value: string | Date): Date {
  return new Date(new Date(value).getTime() + BANGKOK_OFFSET_MS);
}

/** 2026-11-05 -> 5 พ.ย. 2569 (Buddhist Era) */
export function formatThaiDate(value: string | Date): string {
  const date = toBangkok(value);
  return `${date.getUTCDate()} ${THAI_MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear() + 543}`;
}

/** 5 พ.ย. 2569 14:30 น. */
export function formatThaiDateTime(value: string | Date): string {
  const date = toBangkok(value);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatThaiDate(value)} ${hours}:${minutes} น.`;
}
