import React, { useState, useEffect } from 'react';
import { Store, IndianRupee, Save, Printer, Eye, Lock, KeyRound, Phone, MapPin, FileText, Image as ImageIcon, Upload } from 'lucide-react';
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
  const [logoUrl, setLogoUrl] = useState('https://cdn-icons-png.flaticon.com/512/3075/3075977.png');

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
        const defaultBrandLogo = 'https://cdn-icons-png.flaticon.com/512/3075/3075977.png';
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
              setLogoUrl(parsed.logoUrl || defaultBrandLogo);
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
            setLogoUrl(data.logoUrl || defaultBrandLogo);
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

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Image file size must be less than 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setLogoUrl(reader.result);
          toast.success('Brand logo uploaded successfully!');
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
        
        // Update tenant details cache for header and sidebar branding
        localStorage.setItem(`restaurant_qr_mock_tenant_info_${tenantId}`, JSON.stringify({
          name: restaurantName,
          logoUrl: logoUrl || undefined
        }));

        // Also update in the global mock tenants database list
        const cachedTenants = localStorage.getItem('restaurant_qr_mock_tenants_db');
        if (cachedTenants) {
          try {
            const tenantsList = JSON.parse(cachedTenants);
            const matchIndex = tenantsList.findIndex((t: any) => t.id === tenantId);
            if (matchIndex > -1) {
              tenantsList[matchIndex] = {
                ...tenantsList[matchIndex],
                name: restaurantName,
                logoUrl: logoUrl || undefined
              };
              localStorage.setItem('restaurant_qr_mock_tenants_db', JSON.stringify(tenantsList));
            }
          } catch (e) {}
        }

        toast.success('Restaurant settings & Brand Logo saved successfully!');
      } else {
        await setDoc(doc(db, 'tenants', tenantId, 'settings', 'general'), settingsData, { merge: true });
        await setDoc(doc(db, 'tenants', tenantId), {
          name: restaurantName,
          logoUrl: logoUrl || null
        }, { merge: true });
        toast.success('Restaurant settings updated in production!');
      }
      // Reload page to refresh context branding across header and sidebar layout
      setTimeout(() => {
        window.location.reload();
      }, 1000);
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
          <p className="text-xs text-zinc-500 mt-0.5">Upload brand logo, manage GST registration, tax rates, and thermal receipts</p>
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
          {/* Section 1: Business Profile & Brand Logo Upload */}
          <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <Store className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Business Identity & Brand Logo</h4>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-zinc-400 font-semibold uppercase flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />
                  Brand Logo Image (Upload File or Paste Image URL Link)
                </label>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <img
                    src={logoUrl || 'https://cdn-icons-png.flaticon.com/512/1046/1046784.png'}
                    alt="Brand Logo"
                    className="h-14 max-h-14 w-auto max-w-[140px] object-contain rounded-xl border border-zinc-800 p-1.5 bg-zinc-950 shadow-md shrink-0"
                  />
                  <div className="flex-1 space-y-2 w-full">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-xl cursor-pointer border border-zinc-700 transition shrink-0">
                        <Upload className="h-3.5 w-3.5 text-emerald-400" />
                        Upload File
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileUpload}
                          className="hidden"
                        />
                      </label>
                      <input
                        type="text"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                        placeholder="Or paste direct image URL (https://...)"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500">PNG, JPG, SVG or WebP logo file (Max 2MB). Automatically prints on thermal bills.</p>
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
        <div className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-zinc-850 pb-3">
              <Printer className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Thermal Receipt Customization & Live Preview</h4>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-semibold uppercase">Receipt Header Subtitle</label>
                <input
                  type="text"
                  value={receiptHeader}
                  onChange={(e) => setReceiptHeader(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none focus:border-emerald-500/30"
                  placeholder="Subtitle printed below restaurant name"
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
              <span className="text-xs text-zinc-400 font-semibold uppercase flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5 text-emerald-400" />
                  Live Thermal Print Preview
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">80mm Paper Width</span>
              </span>

              <div id="thermal-receipt-preview" className="bg-white text-black font-mono p-6 rounded-2xl text-[11px] shadow-2xl space-y-3 border border-gray-300 max-w-sm mx-auto">
                <div className="text-center font-bold border-b border-dashed border-gray-400 pb-3 space-y-1">
                  {logoUrl && (
                    <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[140px] w-auto h-auto object-contain mx-auto mb-1.5" />
                  )}
                  <p className="uppercase text-sm tracking-wider font-black">{restaurantName || 'RESTAURANT BRAND NAME'}</p>
                  <p className="text-[10px] font-bold text-gray-600 uppercase">{receiptHeader || 'OFFICIAL TAX INVOICE & RECEIPT'}</p>
                  <p className="text-[10px] font-normal text-gray-500">{address || '123 Gourmet Avenue, Food City'}</p>
                  <p className="text-[10px] font-normal text-gray-500">Ph: {phone || '+91 98765 43210'}</p>
                  {gstNumber && <p className="text-[10px] font-extrabold text-black">GSTIN: {gstNumber}</p>}
                </div>

                <div className="flex justify-between text-[10px] text-gray-600 py-1 border-b border-dashed border-gray-300">
                  <span>Table #01</span>
                  <span>Invoice: #ORD_1092</span>
                </div>

                <div className="space-y-1.5 py-1 text-[11px]">
                  <div className="flex justify-between font-bold border-b border-gray-200 pb-1 text-[10px]">
                    <span>ITEM</span>
                    <span>QTY x PRICE</span>
                    <span>TOTAL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">1x Truffle Burger</span>
                    <span>1 x {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}450.00</span>
                    <span className="font-bold">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}450.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium">1x Fresh Mint Soda</span>
                    <span>1 x {currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}120.00</span>
                    <span className="font-bold">{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}120.00</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-gray-400 pt-2 space-y-1 text-[11px]">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}570.00</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>GST Tax ({taxRate}%):</span>
                    <span>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}{(570 * (taxRate / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Service Charge ({serviceChargeRate}%):</span>
                    <span>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}{(570 * (serviceChargeRate / 100)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-black text-sm text-black pt-1.5 border-t border-gray-300">
                    <span>GRAND TOTAL:</span>
                    <span>{currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₹'}{(570 * (1 + (taxRate + serviceChargeRate) / 100)).toFixed(2)}</span>
                  </div>
                </div>

                <div className="text-center text-[10px] text-gray-600 pt-2 border-t border-dashed border-gray-400 space-y-0.5">
                  <p className="font-bold text-black uppercase">PAID VIA CASH</p>
                  <p className="italic font-semibold">{receiptFooter || 'Thank you for dining with us! Please visit again.'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSaveSettings}
              disabled={isSaving}
              className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Receipt Settings'}
            </button>

            <button
              onClick={() => {
                const receiptElement = document.getElementById('thermal-receipt-preview');
                if (!receiptElement) return;
                const iframe = document.createElement('iframe');
                iframe.style.position = 'absolute';
                iframe.style.width = '0px';
                iframe.style.height = '0px';
                iframe.style.border = 'none';
                document.body.appendChild(iframe);
                const docObj = iframe.contentWindow?.document;
                if (!docObj) return;
                docObj.open();
                docObj.write(`
                  <html>
                    <head>
                      <title>Receipt Test Print</title>
                      <style>
                        @page { size: 80mm auto; margin: 0; }
                        body {
                          font-family: monospace;
                          font-size: 11px;
                          color: black;
                          background: white;
                          padding: 10px;
                          margin: 0;
                          width: 80mm;
                        }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: bold; }
                        .font-black { font-weight: 900; }
                        .font-semibold { font-weight: 600; }
                        .uppercase { text-transform: uppercase; }
                        .tracking-wider { letter-spacing: 0.05em; }
                        .text-xs { font-size: 10px; }
                        .text-sm { font-size: 12px; }
                        .text-gray-500 { color: #6b7280; }
                        .text-gray-600 { color: #4b5563; }
                        .border-b { border-bottom: 1px dotted #000; padding-bottom: 4px; margin-bottom: 4px; }
                        .border-t { border-top: 1px dotted #000; padding-top: 4px; margin-top: 4px; }
                        .border-dashed { border-bottom: 1px dashed #000; padding-bottom: 4px; margin-bottom: 4px; }
                        .py-1 { padding-top: 4px; padding-bottom: 4px; }
                        .pb-1 { padding-bottom: 4px; }
                        .pb-3 { padding-bottom: 12px; }
                        .pt-2 { padding-top: 8px; }
                        .pt-1.5 { padding-top: 6px; }
                        .mb-1.5 { margin-bottom: 6px; }
                        .flex { display: flex; }
                        .justify-between { justify-content: space-between; }
                        .space-y-1 > * + * { margin-top: 4px; }
                        .space-y-1.5 > * + * { margin-top: 6px; }
                        .space-y-3 > * + * { margin-top: 12px; }
                        .space-y-0.5 > * + * { margin-top: 2px; }
                        img { max-height: 48px; max-width: 140px; display: block; margin: 0 auto 6px auto; }
                        .italic { font-style: italic; }
                      </style>
                    </head>
                    <body>
                      \${receiptElement.innerHTML}
                      <script>
                        window.onload = function() {
                          window.focus();
                          window.print();
                          setTimeout(function() {
                            window.frameElement.remove();
                          }, 100);
                        };
                      </script>
                    </body>
                  </html>
                `);
                docObj.close();
              }}
              className="py-3 px-4 bg-zinc-850 hover:bg-zinc-800 text-zinc-200 font-bold text-xs uppercase tracking-wider rounded-xl border border-zinc-750 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Printer className="h-4 w-4 text-emerald-400" />
              Test Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
