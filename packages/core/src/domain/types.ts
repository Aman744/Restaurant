export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  logoUrl?: string;
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

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  tenantId?: string;
  permissions?: string[];
  createdAt: Date;
}

export type DietaryTag = 'veg' | 'non-veg' | 'vegan' | 'jain' | 'gluten-free';

export interface MenuItem {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  discountedPrice?: number;
  images: string[];
  dietaryTags: DietaryTag[];
  spiceLevel?: 1 | 2 | 3;
  allergens: string[];
  stockStatus: 'in-stock' | 'out-of-stock' | 'limited';
  preparationTime: number;
  variants?: {
    id: string;
    name: string;
    options: { name: string; priceAdjustment: number }[];
  }[];
  addons?: {
    id: string;
    name: string;
    price: number;
  }[];
  isActive: boolean;
}

export interface MenuCategory {
  id: string;
  tenantId: string;
  name: string;
  order: number;
  isActive: boolean;
}

export interface Table {
  id: string;
  tenantId: string;
  number: string;
  seatingCapacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  qrToken: string;
  activeOrderId?: string;
  createdAt: Date;
}

export type OrderStatus = 'pending' | 'accepted' | 'preparing' | 'ready' | 'served' | 'completed' | 'archived';
export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'refunded';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'razorpay' | 'stripe';

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  stationId: 'main' | 'grill' | 'pizza' | 'bakery' | 'dessert' | 'drinks' | 'packaging' | 'bar';
  status: 'pending' | 'preparing' | 'ready' | 'served';
  selectedVariant?: { id: string; name: string; priceAdjustment: number };
  selectedAddons?: { id: string; name: string; price: number }[];
}

export interface Order {
  id: string;
  tenantId: string;
  tableId: string;
  tableNumber: string;
  customerId: string;
  customerName?: string;
  status: OrderStatus;
  kitchenStationStatus: Record<string, 'pending' | 'preparing' | 'ready'>;
  totals: {
    subtotal: number;
    tax: number;
    serviceCharge: number;
    tip: number;
    discount: number;
    grandTotal: number;
  };
  payment: {
    status: PaymentStatus;
    method?: PaymentMethod;
    transactionId?: string;
    amountPaid: number;
  };
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
}

export interface InventoryItem {
  id: string;
  tenantId: string;
  name: string;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'pcs';
  currentStock: number;
  minStockLevel: number;
  supplierId?: string;
  avgCost: number;
}

export interface Recipe {
  id: string;
  tenantId: string;
  menuItemId: string;
  ingredients: {
    inventoryItemId: string;
    quantityRequired: number;
  }[];
}

export interface Reservation {
  id: string;
  tenantId: string;
  tableId?: string;
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
  action: 'earn' | 'redeem' | 'expire';
  description: string;
  expiryDate?: Date;
  createdAt: Date;
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
