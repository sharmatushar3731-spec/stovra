export interface SavedAddress {
  id: string;
  label: string;
  line: string;
  pincode: string;
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface NotificationPrefs {
  booking: boolean;
  payment: boolean;
  expiry: boolean;
  inventory: boolean;
  promotional: boolean;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  mobileVerified: boolean;
  address: string;
  pincode: string;
  savedAddresses: SavedAddress[];
  emergencyContact: EmergencyContact;
  notificationPrefs: NotificationPrefs;
  avatarUrl: string;
  referralCode: string;
  walletBalance: number;
  role: string;
  deletionRequestedAt: string | null;
  createdAt: string;
}

export interface StorageUnit {
  id: string;
  facilityId: string;
  unitCode: string;
  sizeLabel: string;
  areaSqft: number;
  dimensions: string;
  storageType: string;
  climateControlled: boolean;
  floorLevel: string;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  status: 'available' | 'occupied' | 'maintenance';
}

export interface StorageFacility {
  id: string;
  name: string;
  slug: string;
  city: string;
  locality: string;
  pincode: string;
  address: string;
  lat: number;
  lng: number;
  description: string;
  imageUrl: string;
  gallery: string[];
  rating: number;
  reviewCount: number;
  amenities: string[];
  securityFeatures: string[];
  climateControlled: boolean;
  operatingHours: string;
  baseDailyRate: number;
  baseWeeklyRate: number;
  baseMonthlyRate: number;
  totalUnits: number;
  availableUnits: number;
  minUnitSqft: number;
  maxUnitSqft: number;
  distanceKm: number | null;
  isWishlisted: boolean;
  units: StorageUnit[];
}

export interface FacilityReview {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  verifiedBooking: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  userId: string;
  facilityId: string;
  facilityName: string;
  facilityCity: string;
  facilityLocality: string;
  facilityAddress: string;
  facilityImage: string;
  unitId: string;
  unitCode: string;
  unitSizeLabel: string;
  unitAreaSqft: number;
  unitDimensions: string;
  checkInDate: string;
  checkOutDate: string;
  durationType: 'daily' | 'weekly' | 'monthly';
  durationCount: number;
  inventorySummary: string;
  itemImages: string[];
  subtotal: number;
  discountAmount: number;
  promoCode: string;
  gstAmount: number;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'pending' | 'advance_paid' | 'paid' | 'refunded';
  bookingStatus: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  qrToken: string;
  cancellationReason: string;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InventoryCategory =
  | 'Furniture'
  | 'Electronics'
  | 'Documents'
  | 'Household goods'
  | 'Business inventory'
  | 'Clothing'
  | 'Other';

export interface InventoryItem {
  id: string;
  itemCode: string;
  userId: string;
  bookingId: string | null;
  bookingCode: string | null;
  facilityId: string | null;
  facilityName: string;
  unitId: string | null;
  unitCode: string | null;
  name: string;
  category: InventoryCategory;
  description: string;
  quantity: number;
  estimatedValue: number;
  dimensions: string;
  images: string[];
  qrToken: string;
  movementStatus: 'in_storage' | 'checked_out' | 'in_transit';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLog {
  id: string;
  action: 'checked_in' | 'checked_out' | 'moved' | 'verified';
  locationNote: string;
  timestamp: string;
}

export interface PaymentTransaction {
  id: string;
  orderId: string;
  paymentId: string;
  bookingId: string;
  bookingCode: string;
  facilityName: string;
  unitCode: string;
  amount: number;
  paymentMode: 'advance' | 'full';
  method: 'upi' | 'card' | 'netbanking' | 'wallet';
  status: 'created' | 'captured' | 'failed' | 'refunded';
  signatureVerified: boolean;
  invoiceNumber: string;
  refundStatus: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt: string | null;
  link: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketCode: string;
  category: string;
  subject: string;
  description: string;
  screenshotUrl: string;
  status: 'open' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface FAQItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface DashboardResponse {
  stats: {
    activeBookings: number;
    upcomingBookings: number;
    storedItemsCount: number;
    uniqueItemEntries: number;
    insuredEstimatedValue: number;
    availableStorageBalance: number;
    totalSqftBooked: number;
    mobileVerified: boolean;
    unreadNotifications: number;
  };
  bookings: Array<{
    id: string;
    bookingCode: string;
    checkInDate: string;
    checkOutDate: string;
    bookingStatus: string;
    paymentStatus: string;
    totalAmount: number;
    paidAmount: number;
    facilityName: string;
    facilityCity: string;
    unitCode: string;
    areaSqft: number;
  }>;
  expiryPredictions: Array<{
    bookingId: string;
    bookingCode: string;
    facilityName: string;
    checkOutDate: string;
    daysRemaining: number;
    urgency: 'critical' | 'upcoming' | 'healthy';
  }>;
  recentActivities: Array<{
    id: string;
    action: string;
    locationNote: string;
    timestamp: string;
    itemName: string;
    itemCode: string;
  }>;
  paymentHistory: Array<{
    id: string;
    orderId: string;
    amount: number;
    method: string;
    status: string;
    invoiceNumber: string;
    createdAt: string;
    bookingCode: string;
  }>;
  notifications: AppNotification[];
}
