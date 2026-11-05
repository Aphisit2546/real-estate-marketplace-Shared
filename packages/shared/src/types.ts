import type {
  AppointmentStatus, AppRole, FurnishingLevel, ListingPurpose, ListingStatus, PetPolicy, ReportReason, ReportStatus,
  UserStatus, VerificationStatus, VerificationType,
} from './constants';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
export interface PageMeta { page: number; limit: number; total: number; totalPages: number }
export interface CursorMeta { nextCursor: string | null; limit: number }
export interface Paged<T> { data: T[]; meta: PageMeta }
export interface CursorPaged<T> { data: T[]; meta: CursorMeta }

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface CurrentUser {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  lineId: string | null;
  bio: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  roles: AppRole[];
  isVerified: boolean;
  createdAt: string;
}

export interface Category { id: number; slug: string; nameTh: string; nameEn: string; isActive: boolean; sortOrder: number }
export interface Amenity { id: number; code: string; scope: 'building' | 'unit'; nameTh: string; nameEn: string; isActive: boolean; sortOrder: number }
export interface LocationItem { id: number; code: string; level: string; parentId: number | null; nameTh: string; nameEn: string; postalCode: string | null }
export interface PublicSettings { dailyRentalEnabled: boolean; maxImagesPerListing: number; videoEnabled: boolean; verificationEnabled: boolean }
export interface PropertyOption { id: string; kind: string; nameTh: string; nameEn: string | null; address: string; province: string; district: string }

export interface ListingSummary {
  id: string;
  title: string;
  purpose: ListingPurpose;
  status: ListingStatus;
  categorySlug: string;
  categoryName: string;
  salePrice: number | null;
  monthlyRent: number | null;
  dailyRent: number | null;
  areaSqm: number;
  bedrooms: number;
  bathrooms: number;
  floor: number | null;
  furnishing: FurnishingLevel;
  propertyName: string;
  province: string;
  district: string;
  lat: number | null;
  lng: number | null;
  coverUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  isFavorite: boolean;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
  sortOrder: number;
  isCover: boolean;
}

export interface ListingDetail extends ListingSummary {
  description: string;
  deposit: number | null;
  bookingFee: number | null;
  additionalTerms: string | null;
  rentalTerms: string | null;
  minLeaseMonths: number | null;
  petPolicy: PetPolicy;
  availableFrom: string | null;
  contactName: string;
  /** Only returned to signed-in users to slow down harvesting. */
  contactPhone: string | null;
  contactLine: string | null;
  videoUrl: string | null;
  virtualTourUrl: string | null;
  propertyId: string;
  categoryId: number;
  address: string;
  provinceId: number;
  districtId: number;
  subdistrictId: number | null;
  subdistrict: string | null;
  postalCode: string | null;
  parkingSpaces: number;
  appliances: string[];
  /** Only returned to the owner and admins. */
  unitNumber: string | null;
  images: ListingImage[];
  amenities: Amenity[];
  owner: { id: string; displayName: string; avatarUrl: string | null; isVerified: boolean };
  rejectedReason: string | null;
  expiresAt: string | null;
  updatedAt: string;
  isOwner: boolean;
}

export interface OwnerListing extends ListingSummary {
  rejectedReason: string | null;
  expiresAt: string | null;
  totalViews: number;
  favoriteCount: number;
  conversationCount: number;
}

export interface ListingStats {
  totalViews: number;
  favoriteCount: number;
  conversationCount: number;
  appointmentCount: number;
  daily: { day: string; views: number }[];
}

export interface ConversationSummary {
  id: string;
  listingId: string;
  listingTitle: string;
  listingCoverUrl: string | null;
  otherUser: { id: string; displayName: string; avatarUrl: string | null };
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  isBlocked: boolean;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  kind: 'text' | 'listing_ref' | 'system';
  body: string;
  refListingId: string | null;
  createdAt: string;
}

export interface ConversationThread {
  conversation: ConversationSummary;
  messages: Message[];
  otherLastReadAt: string | null;
}

export interface Appointment {
  id: string;
  listingId: string;
  listingTitle: string;
  requesterId: string;
  requesterName: string;
  ownerId: string;
  ownerName: string;
  scheduledAt: string;
  proposedAt: string | null;
  proposedBy: string | null;
  status: AppointmentStatus;
  note: string | null;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export interface SavedSearch { id: string; name: string; criteria: Record<string, unknown>; createdAt: string }
export interface SearchHistoryItem { id: number; criteria: Record<string, unknown>; createdAt: string }

export interface VerificationRequest {
  id: string;
  userId: string;
  userName?: string;
  type: VerificationType;
  status: VerificationStatus;
  note: string | null;
  reviewNote: string | null;
  documentUrls?: string[];
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  listingId: string | null;
  listingTitle: string | null;
  reportedUserId: string | null;
  reportedUserName: string | null;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  resolutionNote: string | null;
  createdAt: string;
}

export interface AdminDashboard {
  totals: {
    users: number;
    listings: number;
    pendingListings: number;
    saleListings: number;
    rentListings: number;
    rejectedListings: number;
    suspendedUsers: number;
    openReports: number;
  };
  recentListings: OwnerListing[];
  pendingReports: Report[];
  trends: { day: string; listings: number; users: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  phone: string | null;
  status: UserStatus;
  roles: AppRole[];
  isVerified: boolean;
  listingCount: number;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AppSetting { key: string; value: unknown; description: string | null; isPublic: boolean }
