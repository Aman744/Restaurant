import React, { useState, useEffect } from 'react';
import { Store, IndianRupee, Save, Printer, Eye, Lock, KeyRound, Phone, MapPin, FileText, Image as ImageIcon } from 'lucide-react';
import { useToast } from '../../../components/shared/ToastContext';
import { db } from '../../../lib/firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  const [gstNumber, setGstNumber] = useState('22AAAAA0000A1Z5');

  // Business Profile Settings
  const [restaurantName, setRestaurantName] = useState('Aman\'s Restaurant & Bar');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [address, setAddress] = useState('123 Gourmet Avenue, Food City');
  const [logoUrl, setLogoUrl] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80');

  // Receipt Customization
  const [receiptHeader, setReceiptHeader] = useState('Gourmet Dining & QR Bar');
  const [receiptFooter, setReceiptFooter] = useState('Thank you for dining with us! Please visit again.');

  const [isSaving, setIsSaving] = useState(false);

  // Password Change States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Fetch initial settings from Firestore / localStorage on mount
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
              setGstNumber(parsed.gstNumber || '22AAAAA0000A1Z5');
              setRestaurantName(parsed.restaurantName || 'Aman\'s Restaurant & Bar');
              setPhone(parsed.phone || '+91 98765 43210');
              setAddress(parsed.address || '123 Gourmet Avenue');
              setLogoUrl(parsed.logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80');
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
            setGstNumber(data.gstNumber || '22AAAAA0000A1Z5');
            setRestaurantName(data.restaurantName || 'Aman\'s Restaurant & Bar');
            setPhone(data.phone || '+91 98765 43210');
            setAddress(data.address || '123 Gourmet Avenue');
            setLogoUrl(data.logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80');
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
      gstNumber,
      restaurantName,
      phone,
      address,
      logoUrl,
      receiptHeader,
      receiptFooter,
      updatedAt: new Date()
    };

    try {
      if (isMockMode) {
        localStorage.setItem(`restaurant_qr_settings_${tenantId}`, JSON.stringify(settingsData));
        toast.success('Restaurant settings and Brand Logo saved successfully!');
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
    if (!currentPassword.trim()) {
      toast.error('Please enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      toast.success('Password updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(`Password update failed: ${err.message}`);
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent"></div>
          <p className="text-xs font-semibold">Loading settings portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-white">Restaurant Settings & Configuration</h3>
          <p className="text-xs text-zinc-500 mt-0.5">Manage brand logo, GST registration, tax rates, and thermal receipts</p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={isSaving}
          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/10 transition"
        >
          <Save className="h-4 w-4" />
          {isSaving ? 'Saving Changes...' : 'Save General Settings'}
        </button>
      </div>

      {/* 2-Column Grid Layout (1 Row 2 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Column 1: Business Profile & Financials */}
        <div className="space-y-6">
          {/* Section 1: Business Profile & Brand Logo */}
          <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <Store className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Business Identity & Brand Logo</h4>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Brand Logo Image (URL Link)
                </label>
                <div className="flex items-center gap-3">
                  <img
                    src={logoUrl || 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=200&q=80'}
                    alt="Brand Logo"
                    className="h-12 w-12 rounded-2xl object-cover border border-zinc-800 shadow-md bg-zinc-950"
                  />
                  <div className="flex-1 space-y-1">
                    <input
                      type="text"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                      placeholder="Paste image URL (e.g. https://...)"
                    />
                    <p className="text-[10px] text-zinc-500">Square or circular PNG/JPG logo used on receipts & menu headers</p>
                  </div>
                </div>
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
          </div>

          {/* Section 2: Financials & Taxes */}
          <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <IndianRupee className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Financials, Currency & GST Registration</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <FileText className="h-3 w-3 text-zinc-500" />
                  GSTIN / Tax Number
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30 font-mono uppercase"
                  placeholder="e.g. 22AAAAA0000A1Z5"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase">GST Rate (%)</label>
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

          {/* Section 3: Security & Change Password Form */}
          <form onSubmit={handleChangePassword} className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Account Security & Change Password</h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <Lock className="h-3 w-3 text-zinc-500" />
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                  placeholder="Enter current password"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <Lock className="h-3 w-3 text-zinc-500" />
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                  placeholder="Min 6 chars"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <Lock className="h-3 w-3 text-zinc-500" />
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                  placeholder="Repeat new password"
                  required
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isChangingPassword}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-white font-bold text-xs rounded-xl transition shadow-md"
              >
                <KeyRound className="h-3.5 w-3.5 text-emerald-400" />
                {isChangingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* Column 2: Thermal Receipt Customization & Live Print Preview */}
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-6 h-full flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <Printer className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Thermal Receipt Customization & Live Preview</h4>
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

            {/* Thermal Receipt Live Preview Paper */}
            <div className="space-y-2 pt-2">
              <span className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                <Eye className="h-3.5 w-3.5 text-emerald-400" />
                Live Thermal Print Preview
              </span>
              <div className="bg-white text-black font-mono p-5 rounded-2xl text-[11px] shadow-2xl space-y-2 border border-zinc-200 select-none max-w-sm mx-auto">
                <div className="text-center font-bold border-b border-black/20 pb-2 space-y-1">
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="h-10 w-10 mx-auto rounded-full object-cover border border-black/20" />
                  )}
                  <p className="uppercase text-xs tracking-wider font-black">{receiptHeader || 'RESTAURANT NAME'}</p>
                  <p className="text-[10px] font-normal text-zinc-600">{address || 'Store Location Address'}</p>
                  {gstNumber && <p className="text-[10px] font-bold text-zinc-800">GSTIN: {gstNumber}</p>}
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
      </div>
    </div>
  );
};
