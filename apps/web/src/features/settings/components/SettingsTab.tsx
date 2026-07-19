import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useToast } from '../../../components/shared/ToastContext';
import { Save, Store, Receipt, DollarSign, Phone, MapPin, Loader2 } from 'lucide-react';

interface SettingsTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ tenantId, isMockMode }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);

  // Financial & Operational Settings
  const [currency, setCurrency] = useState('INR');
  const [taxRate, setTaxRate] = useState(5.0);
  const [serviceChargeRate, setServiceChargeRate] = useState(10.0);

  // Business Profile Settings
  const [restaurantName, setRestaurantName] = useState('My Restaurant');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('123 Gourmet Avenue, Food City');

  // Receipt Customization
  const [receiptHeader, setReceiptHeader] = useState('Gourmet Dining & QR Bar');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us! Please visit again.');

  const [isSaving, setIsSaving] = useState(false);

  // Fetch initial settings from Firestore on mount
  useEffect(() => {
    let active = true;

    const fetchSettings = async () => {
      setLoading(true);
      try {
        if (isMockMode) {
          const stored = localStorage.getItem(`restaurant_qr_settings_${tenantId}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            if (active) {
              setCurrency(parsed.currency || 'INR');
              setTaxRate(parsed.taxRate ?? 5.0);
              setServiceChargeRate(parsed.serviceChargeRate ?? 10.0);
              setRestaurantName(parsed.restaurantName || 'My Restaurant');
              setPhone(parsed.phone || '+91 98765 43210');
              setAddress(parsed.address || '123 Gourmet Avenue');
              setReceiptHeader(parsed.receiptHeader || 'Gourmet Dining');
              setReceiptFooter(parsed.receiptFooter || 'Thank you for dining!');
            }
          }
        } else {
          const docSnap = await getDoc(doc(db, 'tenants', tenantId, 'settings', 'general'));
          if (docSnap.exists() && active) {
            const data = docSnap.data();
            setCurrency(data.currency || 'INR');
            setTaxRate(data.taxRate ?? 5.0);
            setServiceChargeRate(data.serviceChargeRate ?? 10.0);
            setRestaurantName(data.restaurantName || 'My Restaurant');
            setPhone(data.phone || '+91 98765 43210');
            setAddress(data.address || '123 Gourmet Avenue');
            setReceiptHeader(data.receiptHeader || 'Gourmet Dining');
            setReceiptFooter(data.receiptFooter || 'Thank you!');
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchSettings();

    return () => {
      active = false;
    };
  }, [tenantId, isMockMode]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const settingsData = {
      currency,
      taxRate,
      serviceChargeRate,
      restaurantName,
      phone,
      address,
      receiptHeader,
      receiptFooter,
      updatedAt: new Date()
    };

    try {
      if (isMockMode) {
        localStorage.setItem(`restaurant_qr_settings_${tenantId}`, JSON.stringify(settingsData));
        toast.success('Restaurant settings saved successfully!');
      } else {
        await setDoc(doc(db, 'tenants', tenantId, 'settings', 'general'), settingsData, { merge: true });
        toast.success('Restaurant settings updated in production!');
      }
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3 text-zinc-500">
        <Loader2 className="h-7 w-7 animate-spin text-emerald-400" />
        <p className="text-xs font-semibold">Loading restaurant configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h3 className="text-base font-extrabold text-white">Restaurant Settings & Configuration</h3>
        <p className="text-xs text-zinc-500 mt-1">Configure business profile, GST tax rates, thermal receipt branding, and POS settings</p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Section 1: Business Profile */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
            <Store className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Business Identity</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Restaurant Brand Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                placeholder="e.g. Gourmet Bistro"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                <Phone className="h-3 w-3 text-zinc-500" />
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                placeholder="+91 98765 43210"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                <MapPin className="h-3 w-3 text-zinc-500" />
                Physical Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                placeholder="Street name, City, Pin Code"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Financials & Taxes */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
            <DollarSign className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Financials, Currency & GST Rates</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Operating Currency</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
              >
                <option value="INR">Indian Rupee (₹ INR)</option>
                <option value="USD">US Dollar ($ USD)</option>
                <option value="EUR">Euro (€ EUR)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">GST / Tax Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Service Charge Rate (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="50"
                value={serviceChargeRate}
                onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Receipt Branding & Thermal Printing */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
            <Receipt className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Thermal Receipt Customization</h4>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Receipt Header Title</label>
              <input
                type="text"
                value={receiptHeader}
                onChange={(e) => setReceiptHeader(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                placeholder="Title printed at top of thermal receipt"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-semibold uppercase">Receipt Footer Message</label>
              <textarea
                rows={2}
                value={receiptFooter}
                onChange={(e) => setReceiptFooter(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30 resize-none"
                placeholder="Thank you message printed at bottom of receipt"
              />
            </div>
          </div>
        </div>

        {/* Submit Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving Changes...' : 'Save Restaurant Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};
