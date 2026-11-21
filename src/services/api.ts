import axios from 'axios';
import type {
  AppNotification,
  Booking,
  DashboardResponse,
  FAQItem,
  FacilityReview,
  InventoryItem,
  InventoryLog,
  NotificationPrefs,
  PaymentTransaction,
  StorageFacility,
  SupportTicket,
  User,
} from '../types';

// In-memory JWT access token store (never stored in localStorage/sessionStorage).
let memoryAccessToken: string | null = null;

export function setMemoryAccessToken(token: string | null) {
  memoryAccessToken = token;
}

export function getMemoryAccessToken(): string | null {
  return memoryAccessToken;
}

export const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'STOVRA-App',
  },
});

apiClient.interceptors.request.use((config) => {
  if (memoryAccessToken) {
    config.headers.Authorization = `Bearer ${memoryAccessToken}`;
  }
  return config;
});

export function extractApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as { error?: string } | undefined)?.error;
    if (msg) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const authApi = {
  providers: () => apiClient.get<{ googleEnabled: boolean; googleClientId: string | null; smsGatewayConfigured: boolean }>('/auth/providers'),
  session: () => apiClient.get<{ authenticated: boolean; accessToken: string | null; user: User | null }>('/auth/session'),
  register: (payload: { fullName: string; email: string; mobile: string; password: string; referralCode?: string }) =>
    apiClient.post<{
      accessToken: string;
      user: User;
      otpDelivery: { channel: string; maskedMobile: string; previewOtp?: string };
    }>('/auth/register', payload),
  login: (payload: { email: string; password: string }) =>
    apiClient.post<{ accessToken: string; user: User }>('/auth/login', payload),
  googleLogin: (idToken: string) =>
    apiClient.post<{ accessToken: string; user: User }>('/auth/google', { idToken }),
  logout: () => apiClient.post('/auth/logout'),
  sendOtp: (mobile?: string) =>
    apiClient.post<{ ok: boolean; delivery: { channel: string; maskedMobile: string; previewOtp?: string } }>('/auth/otp/send', { mobile }),
  verifyOtp: (otp: string) => apiClient.post<{ ok: boolean; user: User }>('/auth/otp/verify', { otp }),
  forgotPassword: (email: string) =>
    apiClient.post<{ ok: boolean; message: string; delivery?: { channel: string; previewResetCode?: string } }>('/auth/forgot-password', { email }),
  resetPassword: (payload: { email: string; token: string; newPassword: string }) =>
    apiClient.post<{ ok: boolean; message: string }>('/auth/reset-password', payload),
  me: () => apiClient.get<{ user: User }>('/auth/me'),
  updateProfile: (payload: Partial<User>) => apiClient.put<{ user: User }>('/auth/profile', payload),
  uploadAvatar: (imageData: string) => apiClient.post<{ avatarUrl: string; user: User }>('/auth/avatar', { imageData }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    apiClient.put<{ ok: boolean; message: string }>('/auth/password', payload),
  updateNotificationPrefs: (prefs: NotificationPrefs) =>
    apiClient.put<{ user: User }>('/auth/notifications-prefs', prefs),
  requestDeletion: () => apiClient.post<{ ok: boolean; user: User }>('/auth/delete-request'),
};

export const facilitiesApi = {
  list: (params?: Record<string, string | number | boolean | undefined>) =>
    apiClient.get<{ facilities: StorageFacility[] }>('/facilities', { params }),
  detail: (id: string, coords?: { lat?: number; lng?: number }) =>
    apiClient.get<{ facility: StorageFacility; reviews: FacilityReview[] }>(`/facilities/${id}`, { params: coords }),
  recentlyViewed: () => apiClient.get<{ facilities: StorageFacility[] }>('/facilities/recently-viewed'),
  wishlisted: () => apiClient.get<{ facilities: StorageFacility[] }>('/facilities/wishlist/all'),
  toggleWishlist: (id: string) => apiClient.post<{ wishlisted: boolean }>(`/facilities/${id}/wishlist`),
  submitReview: (id: string, payload: { rating: number; comment: string }) =>
    apiClient.post<{ review: FacilityReview }>(`/facilities/${id}/reviews`, payload),
};

export const bookingsApi = {
  quote: (payload: {
    unitId: string;
    checkInDate: string;
    durationType: 'daily' | 'weekly' | 'monthly';
    durationCount: number;
    promoCode?: string;
  }) =>
    apiClient.post<{
      available: boolean;
      checkOutDate: string;
      rate: number;
      subtotal: number;
      discountAmount: number;
      appliedPromo: string;
      promoError: string;
      gstAmount: number;
      totalAmount: number;
    }>('/bookings/quote', payload),
  uploadImage: (imageData: string) => apiClient.post<{ url: string }>('/bookings/upload-image', { imageData }),
  list: () => apiClient.get<{ bookings: Booking[] }>('/bookings'),
  create: (payload: {
    facilityId: string;
    unitId: string;
    checkInDate: string;
    durationType: 'daily' | 'weekly' | 'monthly';
    durationCount: number;
    inventorySummary?: string;
    itemImages?: string[];
    promoCode?: string;
  }) => apiClient.post<{ booking: Booking }>('/bookings', payload),
  detail: (id: string) =>
    apiClient.get<{ booking: Booking; linkedItems: Partial<InventoryItem>[]; payments: PaymentTransaction[] }>(`/bookings/${id}`),
  modify: (id: string, payload: { checkInDate?: string; inventorySummary?: string }) =>
    apiClient.put<{ booking: Booking }>(`/bookings/${id}/modify`, payload),
  extend: (id: string, extraCount: number) => apiClient.post<{ booking: Booking }>(`/bookings/${id}/extend`, { extraCount }),
  cancel: (id: string, reason: string) => apiClient.post<{ booking: Booking }>(`/bookings/${id}/cancel`, { reason }),
};

export const inventoryApi = {
  list: (params?: { q?: string; category?: string }) =>
    apiClient.get<{ items: InventoryItem[] }>('/inventory', { params }),
  uploadImage: (imageData: string) => apiClient.post<{ url: string }>('/inventory/upload-image', { imageData }),
  create: (payload: {
    name: string;
    category: string;
    description?: string;
    quantity: number;
    estimatedValue: number;
    dimensions?: string;
    bookingId?: string | null;
    images?: string[];
  }) => apiClient.post<{ item: InventoryItem }>('/inventory', payload),
  update: (id: string, payload: Partial<InventoryItem>) =>
    apiClient.put<{ item: InventoryItem }>(`/inventory/${id}`, payload),
  move: (id: string, bookingId: string) =>
    apiClient.post<{ item: InventoryItem }>(`/inventory/${id}/move`, { bookingId }),
  logs: (id: string) => apiClient.get<{ logs: InventoryLog[] }>(`/inventory/${id}/logs`),
  remove: (id: string) => apiClient.delete(`/inventory/${id}`),
};

export const qrApi = {
  verify: (qrToken: string, action: 'verify' | 'check_in' | 'check_out' = 'verify') =>
    apiClient.post<{
      authorized: boolean;
      entityType: 'item' | 'booking';
      entity: Record<string, unknown>;
      logs: InventoryLog[];
    }>('/qr/verify', { qrToken, action }),
};

export const paymentsApi = {
  config: () =>
    apiClient.get<{ razorpayKeyId: string; mode: string; supportedMethods: string[] }>('/payments/config'),
  createOrder: (payload: { bookingId: string; paymentMode: 'advance' | 'full'; method: 'upi' | 'card' | 'netbanking' | 'wallet' }) =>
    apiClient.post<{
      order: {
        id: string;
        orderId: string;
        bookingId: string;
        bookingCode: string;
        amountInr: number;
        amountPaise: number;
        currency: string;
        paymentMode: 'advance' | 'full';
        method: string;
        invoiceNumber: string;
        razorpayKeyId: string;
        sandboxAuth: { razorpay_payment_id: string; razorpay_signature: string } | null;
      };
    }>('/payments/create-order', payload),
  verify: (payload: {
    orderId: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    simulateFailure?: boolean;
  }) =>
    apiClient.post<{
      verified: boolean;
      paymentId: string;
      invoiceNumber: string;
      bookingId: string;
      paymentStatus: string;
      bookingStatus: string;
    }>('/payments/verify', payload),
  history: () => apiClient.get<{ transactions: PaymentTransaction[] }>('/payments/history'),
  invoice: (paymentId: string) => apiClient.get<{ invoice: Record<string, unknown> }>(`/payments/invoice/${paymentId}`),
};

export const notificationsApi = {
  list: () => apiClient.get<{ notifications: AppNotification[]; unreadCount: number }>('/notifications'),
  markRead: (id: string) => apiClient.post(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
};

export const supportApi = {
  faqs: () => apiClient.get<{ faqs: FAQItem[] }>('/support/faqs'),
  tickets: () => apiClient.get<{ tickets: SupportTicket[] }>('/support/tickets'),
  uploadScreenshot: (imageData: string) => apiClient.post<{ url: string }>('/support/upload-screenshot', { imageData }),
  createTicket: (payload: { category: string; subject: string; description: string; screenshotUrl?: string }) =>
    apiClient.post<{ ticket: SupportTicket }>('/support/tickets', payload),
};

export const aiApi = {
  spaceCalculator: (payload: {
    items: Array<{
      name: string;
      category: string;
      quantity: number;
      lengthFt?: number;
      widthFt?: number;
      heightFt?: number;
    }>;
    city?: string;
    climateSensitive?: boolean;
  }) =>
    apiClient.post<{
      engine: 'gemini' | 'rule_based';
      recommendedSqft: number;
      totalCubicFt: number;
      recommendedTier: string;
      packingGuidance: string;
      recommendedUnits: Array<{
        unitId: string;
        unitCode: string;
        sizeLabel: string;
        areaSqft: number;
        monthlyRate: number;
        facilityId: string;
        facilityName: string;
        city: string;
        locality: string;
        climateControlled: boolean;
      }>;
    }>('/ai/space-calculator', payload),
  inventoryAssistant: (payload: { itemName: string; description?: string }) =>
    apiClient.post<{
      engine: 'gemini' | 'rule_based';
      suggestedCategory: string;
      needsClimateControl: boolean;
      packingTip: string;
    }>('/ai/inventory-assistant', payload),
  priceEstimator: (payload: { areaSqft: number; city?: string; climateControlled?: boolean }) =>
    apiClient.post<{
      matchedUnit?: string;
      facilityName?: string;
      city?: string;
      estimates: {
        sevenDays: { base: number; gst: number; total: number };
        oneMonth: { base: number; gst: number; total: number };
        threeMonths: { base: number; gst: number; total: number };
        sixMonthsWithPromo: { base: number; discount: number; total: number };
        dailyRate: number;
      } | null;
    }>('/ai/price-estimator', payload),
};

export const dashboardApi = {
  get: () => apiClient.get<DashboardResponse>('/dashboard'),
};
