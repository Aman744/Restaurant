import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserProfile } from './UserContext.js';
import { useAuth } from './AuthContext.js';
import { db } from '../../../lib/firebase.js';
import { TenantRepository } from '@restaurant-qr/infra';
import type { Tenant } from '@restaurant-qr/core';

interface TenantContextType {
  tenant: Tenant | null;
  loading: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, loading: profileLoading } = useUserProfile();
  const { isMockMode } = useAuth();
  
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;

    const fetchTenantData = async () => {
      if (!profile || !profile.tenantId) {
        setTenant(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (isMockMode) {
          const cached = localStorage.getItem(`restaurant_qr_mock_tenant_info_${profile.tenantId}`);
          let brandName = 'Le Bistro Parisien (Sandbox)';
          let logoUrl: string | undefined = undefined;
          if (cached) {
            try {
              const parsed = JSON.parse(cached);
              brandName = parsed.name || brandName;
              logoUrl = parsed.logoUrl || undefined;
            } catch (e) {
              console.error(e);
            }
          }

          const mockTenant: Tenant = {
            id: profile.tenantId,
            name: brandName,
            logoUrl: logoUrl,
            theme: {
              primaryColor: '#e11d48',
              secondaryColor: '#f43f5e',
              fontFamily: 'Inter',
              receiptTheme: { header: brandName, footer: 'Merci!', showTaxDetails: true },
              pwaTheme: { themeColor: '#e11d48', backgroundColor: '#000000' }
            },
            subscription: {
              planId: 'growth',
              status: 'active',
              currentPeriodEnd: new Date('2027-01-01'),
              limits: { tablesPerRestaurant: 30, monthlyOrders: 5000 }
            },
            createdAt: new Date()
          };

          if (active) {
            setTenant(mockTenant);
          }
        } else {
          // Read from active Firestore database
          const tenantRepo = new TenantRepository(db);

          const tenantDoc = await tenantRepo.getById(profile.tenantId);
          if (tenantDoc && active) {
            setTenant(tenantDoc);
          }
        }
      } catch (err) {
        console.error('Error fetching tenant data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    if (!profileLoading) {
      fetchTenantData();
    }

    return () => {
      active = false;
    };
  }, [profile, profileLoading, isMockMode]);

  return (
    <TenantContext.Provider value={{ tenant, loading }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};
