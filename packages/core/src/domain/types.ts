export interface AuditFields {
  createdAt?: Date;
  createdBy?: string;
  updatedAt?: Date;
  updatedBy?: string;
  isDeleted?: boolean;
  deletedAt?: Date;
  deletedBy?: string;
}

export interface Tenant extends AuditFields {
  id: string;
  name: string;
  domain?: string;
  logoUrl?: string;
  features?: Record<string, boolean>;
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    receiptTheme: {
      header: string;
      footer: string;
      showTaxDetails: boolean;
    };
    pwaTheme: {
      themeColor: string;
      backgroundColor: string;
    };
  };
  subscription: {
    planId: 'starter' | 'growth' | 'enterprise';
    status: 'active' | 'trialing' | 'past_due' | 'canceled';
    currentPeriodEnd: Date;
    stripeSubscriptionId?: string;
    limits: {
      tablesPerRestaurant: number;
      monthlyOrders: number;
    };
    usage?: {
      tables: number;
      ordersThisMonth: number;
      storageUsedBytes: number;
    };
  };
  createdAt: Date;
}

export type UserRole =
  | 'super-admin'
  | 'restaurant-admin'
  | 'manager'
  | 'cashier'
  | 'kitchen-staff'
  | 'waiter'
  | 'customer';

export interface UserProfile extends AuditFields {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
  createdAt: Date;
}

export type DietaryTag = 'veg' | 'non-veg' | 'vegan' | 'jain' | 'gluten-free';

export interface MenuItem extends AuditFields {
  id: string;
  tenantId: string;
  categoryId: string;
  categoryName?: string;
  name: string;
  description: string;
  priceMinor?: number; // Integer minor unit (paise/cents)
  price: number; // Decoupled legacy compatibility
  discountedPriceMinor?: number;
  discountedPrice?: number; // Decoupled legacy compatibility
  images: string[];
  dietaryTags: DietaryTag[];
  spiceLevel?: 1 | 2 | 3;
  allergens: string[];
  stockStatus: 'in-stock' | 'out-of-stock' | 'limited';
  preparationTime: number;
  variants?: {
    id: string;
    name: string;
    priceMinor?: number;
    options?: { name: string; priceAdjustment: number }[]; // Legacy compatibility
  }[];
  addons?: {
    id: string;
    name: string;
    priceMinor?: number;
    price?: number; // Legacy compatibility
  }[];
  modifierGroups?: {
    id: string;
    name: string;
    options: string[];
    required: boolean;
  }[];
  searchKeywords?: string[];
  isActive: boolean;
}

export interface MenuCategory extends AuditFields {
  id: string;
  tenantId: string;
  name: string;
  order: number;
  isActive: boolean;
}

// Central SaaS Feature Keys Registry
export const FEATURES = {
  TABLES: 'tables',
  ROOMS: 'rooms',
  INVENTORY: 'inventory',
  KITCHEN: 'kitchen',
  WAITER: 'waiter',
  CASHIER: 'cashier',
  ANALYTICS: 'analytics',
  LOYALTY: 'loyalty',
  API: 'api',
  MULTI_BRANCH: 'multiBranch'
} as const;

export type FeatureKey = typeof FEATURES[keyof typeof FEATURES];

export interface Table extends AuditFields {
  id: string;
  tenantId: string;
  number: string;
  seatingCapacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  qrToken: string;
  activeSessionId?: string;
  activeOrderId?: string;
  createdAt: Date;
}

export type RoomBillingMode = 'FREE' | 'MINIMUM_SPEND' | 'HOURLY' | 'FIXED' | 'PACKAGE';

export type RoomStatus =
  | 'available'
  | 'reserved'
  | 'checked-in'
  | 'occupied'
  | 'bill-open'
  | 'checkout'
  | 'cleaning'
  | 'inspection'
  | 'maintenance';

export type RoomFeature =
  | 'AC'
  | 'TV'
  | 'Projector'
  | 'Music'
  | 'Smoking'
  | 'Non-Smoking'
  | 'Wheelchair Accessible';

export interface RoomCategory extends AuditFields {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
}

export interface Room extends AuditFields {
  id: string;
  tenantId: string;
  branchId?: string;
  roomNumber: string;
  roomName: string;
  categoryId?: string;
  floor?: number;
  zone?: string;
  capacity: number;
  billingMode: RoomBillingMode;
  basePrice?: number;
  hourlyRate?: number;
  minimumSpend?: number;
  taxProfileId?: string;
  serviceCharge?: number;
  status: RoomStatus;
  activeOrderId?: string;
  activeStayId?: string;
  qr: {
    id: string;
    url: string;
    version: number;
    generatedAt: Date;
    expiresAt?: Date;
    enabled: boolean;
  };
  features: RoomFeature[];
  notes?: string;
  createdAt: Date;
  updatedAt?: Date;
}

export interface RoomReservation extends AuditFields {
  id: string;
  reservationNumber: string;
  tenantId: string;
  branchId?: string;
  roomId: string;
  reservationName: string;
  phone: string;
  guestsCount: number;
  startTime: Date;
  endTime: Date;
  status: 'reserved' | 'checked-in' | 'completed' | 'cancelled';
  notes?: string;
  createdAt: Date;
}

export interface ServiceLocation {
  id: string;
  type: 'table' | 'room' | 'bar-seat' | 'counter' | 'pickup' | string;
  referenceId: string;
  name: string;
  branchId?: string;
  metadata?: Record<string, any>;
}

export interface TableSession extends AuditFields {
  sessionId: string;
  tableId: string;
  tenantId: string;
  guestCount: number;
  sharedCart?: any[];
  paymentStatus: 'unpaid' | 'split_pending' | 'paid';
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'archived';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'razorpay' | 'stripe';

export interface OrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  actorId: string;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  description?: string;
  quantity: number;
  selectedVariantName?: string;
  selectedAddonNames?: string[];
  selectedModifiers?: Record<string, string>;
  unitPriceMinor?: number;
  taxRate?: number;
  totalPriceMinor?: number;
  unitPrice: number; // Legacy compatibility
  totalPrice: number; // Legacy compatibility
  notes?: string;
  stationId: 'main' | 'grill' | 'pizza' | 'bakery' | 'dessert' | 'drinks' | 'packaging' | 'bar';
  status: 'pending' | 'preparing' | 'ready' | 'served';
  selectedVariant?: { id: string; name: string; priceAdjustment: number }; // Legacy compatibility
  selectedAddons?: { id: string; name: string; price: number }[]; // Legacy compatibility
}

export interface Order extends AuditFields {
  id: string;
  tenantId: string;
  tableId: string;
  tableNumber: string;
  serviceLocation?: ServiceLocation;
  sessionId?: string;
  customerId: string;
  customerName?: string;
  status: OrderStatus;
  statusHistory?: OrderStatusHistory[];
  kitchenStationStatus?: Record<string, 'pending' | 'preparing' | 'ready'>;
  totalsMinor?: {
    subtotal: number;
    tax: number;
    serviceCharge: number;
    tip: number;
    discount: number;
    grandTotal: number;
  };
  totals: {
    subtotal: number;
    tax: number;
    serviceCharge: number;
    tip: number;
    discount: number;
    grandTotal: number;
  }; // Legacy compatibility
  payment: {
    status: PaymentStatus;
    method?: PaymentMethod;
    transactionId?: string;
    amountPaid?: number;
    amountPaidMinor?: number;
  };
  paymentId?: string;
  items: OrderItem[];
  billRequested?: boolean;
  requestedBillAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer extends AuditFields {
  id: string;
  tenantId: string;
  phone?: string;
  email?: string;
  displayName?: string;
  isGuest: boolean;
  mergedIntoCustomerId?: string;
  totalOrders: number;
  lifetimeSpendMinor: number;
  loyaltyPoints: number;
  lastVisit: Date;
}

export interface InventoryItem extends AuditFields {
  id: string;
  tenantId: string;
  name: string;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'pcs';
  availableQty: number;
  reservedQty?: number;
  wastageQty?: number;
  currentStock: number; // Legacy compatibility
  minStockLevel: number;
  supplierId?: string;
  avgCost: number;
}

export interface Recipe extends AuditFields {
  id: string;
  tenantId: string;
  menuItemId: string;
  ingredients: {
    inventoryItemId: string;
    quantityRequired: number;
  }[];
}

export interface Reservation extends AuditFields {
  id: string;
  tenantId: string;
  tableId?: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  dateTime: Date;
  guestsCount: number;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled' | 'no-show';
  smsSent: boolean;
}

export interface LoyaltyLedgerEntry {
  id: string;
  tenantId: string;
  customerId: string;
  points: number;
  reason: string;
  action?: 'earn' | 'redeem' | 'expire'; // Legacy compatibility
  description?: string; // Legacy compatibility
  orderId?: string;
  createdAt: Date;
}

export interface Payment extends AuditFields {
  paymentId: string;
  orderId: string;
  tenantId: string;
  gateway: PaymentMethod;
  transactionId: string;
  status: 'pending' | 'paid' | 'refunded';
  amountMinor: number;
}

export interface Device extends AuditFields {
  id: string;
  tenantId: string;
  deviceName: string;
  platform: 'android' | 'ios' | 'windows' | 'linux' | 'web';
  pushToken?: string;
  isOnline: boolean;
  lastSeen: Date;
  type: 'kiosk' | 'pwa' | 'terminal';
  version: string;
  registeredBy: string;
}

export interface Webhook extends AuditFields {
  id: string;
  tenantId: string;
  url: string;
  events: string[];
  secretHash: string;
  lastRotatedAt: Date;
  isActive: boolean;
}

export interface ApiKey extends AuditFields {
  id: string;
  tenantId: string;
  hashedKey: string;
  name: string;
  scopes: string[];
  lastUsedAt?: Date;
  isRevoked: boolean;
  expiresAt: Date;
}

export interface EventLog {
  id: string;
  tenantId: string;
  type: string;
  version: number;
  source: string;
  correlationId: string;
  entityId: string;
  actorId: string;
  timestamp: Date;
  payload: any;
}

export interface AuditLogEntry {
  id: string;
  tenantId?: string;
  userId?: string;
  userRole?: UserRole;
  eventType: 'login_success' | 'login_failed' | 'mfa_changed' | 'password_reset' | 'user_create' | 'role_change' | 'logout' | 'session_expire' | 'tenant_provision' | 'subscription_change' | 'force_logout';
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  details: string;
}

export interface RoomStay {
  id: string;
  roomId: string;
  roomNumber: string;
  roomName: string;
  checkInDate: string;
  checkInTime: string;
  checkOutDate?: string;
  checkOutTime?: string;
  status: 'reserved' | 'arrived' | 'checked-in' | 'ordering' | 'payment-pending' | 'checked-out' | 'cancelled' | 'expired';
  orderIds: string[];
  paymentIds: string[];
  invoiceId?: string;
  timeline: RoomTimelineEvent[];
  createdAt: Date;
  createdBy: 'customer' | 'staff';
  guestName?: string | null;
  phone?: string | null;
  email?: string | null;
  guestsCount?: number;
  purpose?: string | null;
  notes?: string | null;
}

export interface RoomTimelineEvent {
  id: string;
  timestamp: string;
  action: 'CHECK_IN' | 'JOIN_REQUEST' | 'JOIN_APPROVED' | 'JOIN_REJECTED' | 'MENU_OPENED' | 'ORDER_PLACED' | 'ORDER_CANCELLED' | 'CHECKOUT_REQUEST' | 'PAYMENT' | 'CHECKOUT' | 'HOUSEKEEPING_ASSIGNED' | 'HOUSEKEEPING_STARTED' | 'HOUSEKEEPING_COMPLETED' | 'INSPECTION_APPROVED' | 'ROOM_AVAILABLE';
  actor: 'customer' | 'staff' | 'system';
  metadata?: any;
}

export interface StayGuest {
  id: string;
  stayId: string;
  name: string;
  phone: string;
  email?: string;
  role: 'Primary' | 'Guest';
  status: 'Pending' | 'Approved' | 'Rejected' | 'Removed';
  joinedAt: Date;
  sessionToken: string;
}

export interface HousekeepingTask {
  id: string;
  tenantId: string;
  roomId: string;
  roomNumber: string;
  roomName: string;
  status: 'pending' | 'assigned' | 'in-progress' | 'completed' | 'verified' | 'closed';
  assignedTo?: string;
  assignedStaffName?: string;
  createdAt: Date;
  completedAt?: Date;
  taskType?: 'cleaning' | 'laundry' | 'amenity' | 'concierge' | 'wellness' | 'convenience' | 'waiter' | 'other';
  notes?: string;
}

export interface RoomFeedback {
  id: string;
  tenantId: string;
  stayId: string;
  roomId: string;
  roomNumber: string;
  guestName: string;
  ratings: {
    room: number;
    food: number;
    service: number;
  };
  comment?: string;
  createdAt: Date;
}
