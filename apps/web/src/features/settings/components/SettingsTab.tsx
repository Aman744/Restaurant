import React, { useState } from 'react';
import { db } from '../../../lib/firebase.js';
import { doc, setDoc } from 'firebase/firestore';
import { useToast } from '../../../components/shared/ToastContext';

interface SettingsTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ tenantId, isMockMode }) => {
  const toast = useToast();
  const [currency, setCurrency] = useState('INR');
  const [taxRate, setTaxRate] = useState(5.0);
  const [serviceChargeRate, setServiceChargeRate] = useState(10.0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (isMockMode) {
        toast.success('Restaurant settings saved in sandbox!');
      } else {
        await setDoc(
          doc(db, 'tenants', tenantId, 'settings', 'general'),
          {
            currency,
            taxRate,
            serviceChargeRate,
            updatedAt: new Date()
          },
          { merge: true }
        );
        toast.success('Settings updated successfully!');
      }
    } catch (err: any) {
      toast.error(`Failed to save settings: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Restaurant Settings & Configuration</h3>

      <form onSubmit={handleSaveSettings} className="border border-zinc-800 bg-zinc-900/40 p-6 rounded-3xl space-y-4">
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">GST / Tax Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={taxRate}
              onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-semibold uppercase">Service Charge (%)</label>
            <input
              type="number"
              step="0.1"
              value={serviceChargeRate}
              onChange={(e) => setServiceChargeRate(parseFloat(e.target.value) || 0)}
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-200 rounded-xl focus:outline-none"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/10"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
};
