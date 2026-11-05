import type {
  AdminDashboard, AdminUser, Amenity, ApiErrorBody, AppSetting, Appointment, AuditLog, AuthSession, Category,
  ConversationSummary, ConversationThread, CreateListingInput, CurrentUser, CursorMeta, ListingDetail, ListingImage,
  ListingStats, ListingSummary, LocationItem, LoginInput, Message, NotificationItem, OwnerListing, PageMeta, PropertyOption,
  PublicSettings, RegisterInput, Report, SavedSearch, SearchHistoryItem, UpdateListingInput, VerificationRequest,
} from '@rem/shared';

export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ClientOptions {
  /** Ends in /api/v1 for a direct connection, or /bff when the web proxy adds the token. */
  baseUrl: string;
  getToken?: () => string | null | Promise<string | null>;
  /** Called once on a 401. Return true if the token was refreshed and the call should be retried. */
  refresh?: () => Promise<boolean>;
  fetchFn?: typeof fetch;
  init?: RequestInit;
}

type Query = Record<string, string | number | boolean | undefined | null>;

interface CallOptions {
  query?: Query;
  body?: unknown;
  form?: FormData;
}

function toQueryString(query: Query | undefined): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

export function createApiClient(options: ClientOptions) {
  const doFetch = options.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send(method: string, path: string, call: CallOptions, canRetry: boolean): Promise<Response> {
    const headers: Record<string, string> = {};
    const token = await options.getToken?.();
    if (token) headers.authorization = `Bearer ${token}`;

    let body: BodyInit | undefined;
    if (call.form) {
      body = call.form;
    } else if (call.body !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(call.body);
    }

    const response = await doFetch(`${options.baseUrl}${path}${toQueryString(call.query)}`, {
      ...options.init,
      method,
      headers,
      body,
    });

    if (response.status === 401 && canRetry && options.refresh && (await options.refresh())) {
      return send(method, path, call, false);
    }
    return response;
  }

  async function raw(method: string, path: string, call: CallOptions = {}) {
    const response = await send(method, path, call, true);
    if (response.status === 204) return { data: undefined, meta: undefined };

    const text = await response.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new ApiClientError(response.status, 'INVALID_RESPONSE', 'เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง');
    }
    if (!response.ok) {
      const error = (json as Partial<ApiErrorBody>).error;
      throw new ApiClientError(
        response.status,
        error?.code ?? 'UNKNOWN',
        error?.message ?? 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        error?.details,
      );
    }
    return json as { data: unknown; meta: unknown };
  }

  const one = async <T>(method: string, path: string, call?: CallOptions) =>
    (await raw(method, path, call)).data as T;
  const none = async (method: string, path: string, call?: CallOptions) => {
    await raw(method, path, call);
  };
  const paged = async <T>(path: string, query?: Query) => {
    const { data, meta } = await raw('GET', path, { query });
    return { data: data as T[], meta: meta as PageMeta };
  };

  const fileForm = (file: Blob, name?: string) => {
    const form = new FormData();
    if (name) form.append('file', file, name);
    else form.append('file', file);
    return form;
  };

  return {
    auth: {
      register: (body: RegisterInput) =>
        one<{ session: AuthSession | null; needsEmailConfirmation: boolean }>('POST', '/auth/register', { body }),
      login: (body: LoginInput) => one<{ session: AuthSession }>('POST', '/auth/login', { body }),
      refresh: (refreshToken: string) =>
        one<{ session: AuthSession }>('POST', '/auth/refresh', { body: { refreshToken } }),
      logout: () => none('POST', '/auth/logout'),
      me: () => one<CurrentUser>('GET', '/auth/me'),
      forgotPassword: (email: string, redirectTo?: string) =>
        none('POST', '/auth/forgot-password', { body: { email, redirectTo } }),
      resendVerification: (email: string, redirectTo?: string) =>
        none('POST', '/auth/resend-verification', { body: { email, redirectTo } }),
      resetPassword: (password: string) => none('POST', '/auth/reset-password', { body: { password } }),
      oauthUrl: (provider: 'google', redirectTo: string) =>
        one<{ url: string }>('GET', '/auth/oauth', { query: { provider, redirectTo } }),
    },
    users: {
      update: (body: { displayName?: string; phone?: string | null; lineId?: string | null; bio?: string | null }) =>
        one<CurrentUser>('PATCH', '/users/me', { body }),
      uploadAvatar: (form: FormData) => one<CurrentUser>('POST', '/users/me/avatar', { form }),
      becomeLister: (role: 'owner' | 'agent') => one<CurrentUser>('POST', '/users/me/become-lister', { body: { role } }),
      changePassword: (currentPassword: string, newPassword: string) =>
        none('POST', '/users/me/password', { body: { currentPassword, newPassword } }),
      deactivate: () => none('POST', '/users/me/deactivate', { body: { confirm: 'ปิดบัญชี' } }),
      myListings: (query?: Query) => paged<OwnerListing>('/users/me/listings', query),
      searchHistory: () => one<SearchHistoryItem[]>('GET', '/users/me/search-history'),
      clearSearchHistory: () => none('DELETE', '/users/me/search-history'),
      registerPushToken: (token: string, platform: 'ios' | 'android') =>
        none('POST', '/users/me/push-tokens', { body: { token, platform } }),
      removePushToken: (token: string, platform: 'ios' | 'android') =>
        none('DELETE', '/users/me/push-tokens', { body: { token, platform } }),
    },
    catalog: {
      categories: () => one<Category[]>('GET', '/categories'),
      amenities: () => one<Amenity[]>('GET', '/amenities'),
      locations: (level: string, parentId?: number) =>
        one<LocationItem[]>('GET', '/locations', { query: { level, parentId } }),
      settings: () => one<PublicSettings>('GET', '/settings'),
      properties: (q: string) => one<PropertyOption[]>('GET', '/properties', { query: { q } }),
    },
    listings: {
      search: async (query: Query) => {
        const { data, meta } = await raw('GET', '/listings', { query });
        return { data: data as ListingSummary[], meta: meta as CursorMeta };
      },
      get: (id: string) => one<ListingDetail>('GET', `/listings/${id}`),
      create: (body: CreateListingInput) => one<ListingDetail>('POST', '/listings', { body }),
      update: (id: string, body: UpdateListingInput) => one<ListingDetail>('PATCH', `/listings/${id}`, { body }),
      remove: (id: string) => none('DELETE', `/listings/${id}`),
      submitReview: (id: string) => one<ListingDetail>('POST', `/listings/${id}/submit-review`),
      pause: (id: string) => one<ListingDetail>('POST', `/listings/${id}/pause`),
      setStatus: (id: string, status: 'rented' | 'sold' | 'published' | 'draft') =>
        one<ListingDetail>('POST', `/listings/${id}/status`, { body: { status } }),
      stats: (id: string) => one<ListingStats>('GET', `/listings/${id}/stats`),
      recordView: (id: string) => none('POST', `/listings/${id}/view`),
      favorite: (id: string) => none('POST', `/listings/${id}/favorite`),
      unfavorite: (id: string) => none('DELETE', `/listings/${id}/favorite`),
      addImage: (id: string, form: FormData) => one<ListingImage>('POST', `/listings/${id}/images`, { form }),
      removeImage: (id: string, imageId: string) => none('DELETE', `/listings/${id}/images/${imageId}`),
      setCover: (id: string, imageId: string) => none('POST', `/listings/${id}/images/${imageId}/cover`),
      reorderImages: (id: string, imageIds: string[]) => none('PATCH', `/listings/${id}/images`, { body: { imageIds } }),
      fileForm,
    },
    favorites: { list: (query?: Query) => paged<ListingSummary>('/favorites', query) },
    savedSearches: {
      list: () => one<SavedSearch[]>('GET', '/saved-searches'),
      create: (name: string, criteria: Record<string, unknown>) =>
        one<SavedSearch>('POST', '/saved-searches', { body: { name, criteria } }),
      remove: (id: string) => none('DELETE', `/saved-searches/${id}`),
    },
    conversations: {
      list: () => one<ConversationSummary[]>('GET', '/conversations'),
      start: (listingId: string, message: string) =>
        one<{ id: string }>('POST', '/conversations', { body: { listingId, message } }),
      thread: (id: string) => one<ConversationThread>('GET', `/conversations/${id}/messages`),
      send: (id: string, body: string) => one<Message>('POST', `/conversations/${id}/messages`, { body: { body } }),
      markRead: (id: string) => none('POST', `/conversations/${id}/read`),
    },
    blocks: {
      block: (userId: string) => none('POST', '/blocks', { body: { userId } }),
      unblock: (userId: string) => none('DELETE', '/blocks', { body: { userId } }),
    },
    appointments: {
      list: () => one<Appointment[]>('GET', '/appointments'),
      create: (body: { listingId: string; scheduledAt: string; note?: string }) =>
        one<Appointment>('POST', '/appointments', { body }),
      update: (id: string, body: { action: string; scheduledAt?: string }) =>
        one<Appointment>('PATCH', `/appointments/${id}`, { body }),
    },
    notifications: {
      list: async (query?: Query) => {
        const { data, meta } = await raw('GET', '/notifications', { query });
        return { data: data as NotificationItem[], meta: meta as PageMeta & { unread: number } };
      },
      markRead: (id: string) => none('POST', `/notifications/${id}/read`),
      markAllRead: () => none('POST', '/notifications/read-all'),
    },
    reports: {
      create: (body: { listingId?: string; reportedUserId?: string; reason: string; details?: string }) =>
        one<{ id: string }>('POST', '/reports', { body }),
    },
    verification: {
      list: () => one<VerificationRequest[]>('GET', '/verification-requests'),
      create: (form: FormData) => one<{ id: string }>('POST', '/verification-requests', { form }),
    },
    admin: {
      dashboard: () => one<AdminDashboard>('GET', '/admin/dashboard'),
      listings: (query?: Query) => paged<OwnerListing>('/admin/listings', query),
      approve: (id: string) => none('POST', `/admin/listings/${id}/approve`),
      reject: (id: string, reason: string) => none('POST', `/admin/listings/${id}/reject`, { body: { reason } }),
      users: (query?: Query) => paged<AdminUser>('/admin/users', query),
      setUserStatus: (id: string, status: 'active' | 'suspended', reason?: string) =>
        none('PATCH', `/admin/users/${id}/status`, { body: { status, reason } }),
      setUserRole: (id: string, role: string, action: 'grant' | 'revoke') =>
        none('POST', `/admin/users/${id}/roles`, { body: { role, action } }),
      reports: (query?: Query) => paged<Report>('/admin/reports', query),
      resolveReport: (id: string, status: string, note?: string) =>
        none('PATCH', `/admin/reports/${id}`, { body: { status, note } }),
      auditLogs: (query?: Query) => paged<AuditLog>('/admin/audit-logs', query),
      verifications: () => one<VerificationRequest[]>('GET', '/admin/verification-requests'),
      reviewVerification: (id: string, status: 'approved' | 'rejected', note?: string) =>
        none('PATCH', `/admin/verification-requests/${id}`, { body: { status, note } }),
      settings: () => one<AppSetting[]>('GET', '/admin/settings'),
      updateSetting: (key: string, value: boolean | number | string) =>
        none('PATCH', `/admin/settings/${key}`, { body: { value } }),
      categories: () => one<Category[]>('GET', '/admin/categories'),
      createCategory: (body: Omit<Category, 'id'>) => one<Category>('POST', '/admin/categories', { body }),
      updateCategory: (id: number, body: Omit<Category, 'id'>) => one<Category>('PATCH', `/admin/categories/${id}`, { body }),
      amenities: () => one<Amenity[]>('GET', '/admin/amenities'),
      createAmenity: (body: Omit<Amenity, 'id'>) => one<Amenity>('POST', '/admin/amenities', { body }),
      updateAmenity: (id: number, body: Omit<Amenity, 'id'>) => one<Amenity>('PATCH', `/admin/amenities/${id}`, { body }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
