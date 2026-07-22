import { db } from '../lib/firebase.js';
import { doc, getDoc } from 'firebase/firestore';

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  enabled: boolean;
  features: Record<string, boolean>;
  limits: Record<string, number>;
}

const MOCK_PLANS_KEY = 'restaurant_qr_mock_plans_db';

export class SubscriptionPlanService {
  private static cachedPlans: Record<string, SubscriptionPlan> = {};

  static async getPlan(planId: string, isMockMode: boolean): Promise<SubscriptionPlan | null> {
    if (this.cachedPlans[planId]) {
      return this.cachedPlans[planId];
    }

    if (isMockMode) {
      const stored = localStorage.getItem(MOCK_PLANS_KEY);
      let plans: SubscriptionPlan[] = [];
      if (stored) {
        plans = JSON.parse(stored);
      } else {
        // Seed default plans in local storage
        plans = [
          {
            id: 'starter',
            name: 'Starter Plan',
            price: 99,
            enabled: true,
            features: { tables: true, kitchen: true },
            limits: { tablesPerRestaurant: 10, monthlyOrders: 1000 }
          },
          {
            id: 'growth',
            name: 'Growth Plan',
            price: 249,
            enabled: true,
            features: { tables: true, kitchen: true, waiter: true, cashier: true },
            limits: { tablesPerRestaurant: 30, monthlyOrders: 5000 }
          },
          {
            id: 'enterprise',
            name: 'Enterprise Plan',
            price: 499,
            enabled: true,
            features: {
              tables: true,
              rooms: true,
              inventory: true,
              kitchen: true,
              waiter: true,
              cashier: true,
              analytics: true,
              loyalty: true,
              api: true,
              multiBranch: true
            },
            limits: { tablesPerRestaurant: 100, monthlyOrders: 50000, roomsPerRestaurant: 20 }
          }
        ];
        localStorage.setItem(MOCK_PLANS_KEY, JSON.stringify(plans));
      }

      const match = plans.find((p) => p.id === planId) || null;
      if (match) {
        this.cachedPlans[planId] = match;
      }
      return match;
    }

    try {
      const docRef = doc(db, 'subscription_plans', planId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as Omit<SubscriptionPlan, 'id'>;
        this.cachedPlans[planId] = { ...data, id: snap.id };
        return this.cachedPlans[planId];
      }
    } catch (e) {
      console.warn('Failed to load plan from Firestore, using mock fallback:', e);
    }
    return null;
  }

  static clearCache() {
    this.cachedPlans = {};
  }
}
