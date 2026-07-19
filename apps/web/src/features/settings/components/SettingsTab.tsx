import React, { useState, useEffect } from 'react';
import { db, auth } from '../../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useToast } from '../../../components/shared/ToastContext';
import { Save, Store, Receipt, DollarSign, Phone, MapPin, Loader2, KeyRound, Lock, Eye } from 'lucide-react';

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

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

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
              setReceiptHeader(parsed.receiptHeader || 'Gourmet Dining & QR Bar');
              setReceiptFooter(parsed.receiptFooter || 'Thank you for dining with us! Please visit again.');
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
            setReceiptHeader(data.receiptHeader || 'Gourmet Dining & QR Bar');
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      if (isMockMode) {
        toast.success('Account password updated in sandbox!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const user = auth.currentUser;
        if (!user || !user.email) {
          toast.error('No active logged-in user.');
          return;
        }

        if (currentPassword) {
          const credential = EmailAuthProvider.credential(user.email, currentPassword);
          await reauthenticateWithCredential(user, credential);
        }

        await updatePassword(user, newPassword);
        toast.success('Account password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      toast.error(`Failed to update password: ${err.message}`);
    } finally {
      setIsChangingPassword(false);
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
        <p className="text-xs text-zinc-500 mt-1">Configure business profile, GST tax rates, thermal receipt branding, and account security</p>
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

        {/* Section 3: Thermal Receipt Customization & Live Preview */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
            <Receipt className="h-4 w-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Thermal Receipt Customization & Live Preview</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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
                  rows={3}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30 resize-none"
                  placeholder="Thank you message printed at bottom of receipt"
                />
              </div>
            </div>

            {/* Thermal Receipt Live Preview Paper */}
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                Live Thermal Print Preview
              </span>
              <div className="bg-white text-black font-mono p-5 rounded-2xl text-[11px] shadow-2xl space-y-2 border border-zinc-200 select-none">
                <div className="text-center font-bold border-b border-black/20 pb-2">
                  <p className="uppercase text-xs tracking-wider font-black">{receiptHeader || 'RESTAURANT NAME'}</p>
                  <p className="text-[10px] font-normal text-zinc-600 mt-0.5">{address || 'Store Location Address'}</p>
                  <p className="text-[10px] font-normal text-zinc-600">{phone || 'Ph: +91 9876543210'}</p>
                </div>
                <div className="flex justify-between text-[10px] text-zinc-700 py-1 border-b border-black/10">
                  <span>Table #01</span>
                  <span>Sample Bill</span>
                </div>
                <div className="space-y-1 py-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>1x Truffle Burger</span>
                    <span>₹450.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>1x Fresh Mint Soda</span>
                    <span>₹120.00</span>
                  </div>
                </div>
                <div className="border-t border-black/20 pt-2 space-y-1 text-[10px]">
                  <div className="flex justify-between text-zinc-600">
                    <span>Subtotal:</span>
                    <span>₹570.00</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>GST ({taxRate}%):</span>
                    <span>₹{(570 * (taxRate / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-600">
                    <span>Service Charge ({serviceChargeRate}%):</span>
                    <span>₹{(570 * (serviceChargeRate / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-xs pt-1 border-t border-black/20">
                    <span>GRAND TOTAL:</span>
                    <span>₹{(570 * (1 + (taxRate + serviceChargeRate) / 100)).toFixed(2)}</span>
                  </div>
                </div>
                <div className="text-center text-[10px] text-zinc-600 pt-2 border-t border-black/20">
                  <p className="italic">{receiptFooter || 'Thank you for dining with us!'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save General Settings Button */}
        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
          >
            <Save className="h-4 w-4" />
            {isSaving ? 'Saving Changes...' : 'Save General Settings'}
          </button>
        </div>
      </form>

      {/* Section 4: Security & Change Password Form */}
      <form onSubmit={handleChangePassword} className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4 pt-4">
        <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
          <KeyRound className="h-4 w-4 text-emerald-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Account Security & Change Password</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
              <Lock className="h-3 w-3 text-zinc-500" />
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="••••••••"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
              <Lock className="h-3 w-3 text-zinc-500" />
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="Min 6 characters"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
              <Lock className="h-3 w-3 text-zinc-500" />
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
              placeholder="Repeat new password"
              required
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isChangingPassword}
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs rounded-xl transition shadow-md"
          >
            <KeyRound className="h-4 w-4 text-emerald-400" />
            {isChangingPassword ? 'Updating Password...' : 'Update Account Password'}
          </button>
        </div>
      </form>
    </div>
  );
};
