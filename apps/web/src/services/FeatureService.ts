import { SubscriptionPlanService } from './SubscriptionPlanService.js';
import type { Tenant } from '@restaurant-qr/core';

export class FeatureService {
  private static cachedEffectiveFeatures: Record<string, Record<string, boolean>> = {};

  static async getEffectiveFeatures(tenant: Tenant | null, isMockMode: boolean): Promise<Record<string, boolean>> {
    if (!tenant) return {};
    
    // Check local memory cache
    const cacheKey = `${tenant.id}_${tenant.subscription?.planId}_${JSON.stringify(tenant.features || {})}`;
    if (this.cachedEffectiveFeatures[cacheKey]) {
      return this.cachedEffectiveFeatures[cacheKey];
    }

    const planId = tenant.subscription?.planId || 'starter';
    const plan = await SubscriptionPlanService.getPlan(planId, isMockMode);

    const effective: Record<string, boolean> = {
      ...(plan?.features || {})
    };

    // Merge tenant custom overrides
    if (tenant.features) {
      Object.keys(tenant.features).forEach((key) => {
        effective[key] = tenant.features![key];
      });
    }

    this.cachedEffectiveFeatures[cacheKey] = effective;
    return effective;
  }

  static async hasFeature(tenant: Tenant | null, featureKey: string, isMockMode: boolean): Promise<boolean> {
    const effective = await this.getEffectiveFeatures(tenant, isMockMode);
    return !!effective[featureKey];
  }

  static clearCache() {
    this.cachedEffectiveFeatures = {};
  }
}
