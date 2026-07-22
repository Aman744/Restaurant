import React, { useState } from 'react';
import type { RoomCategory, RoomFeature, RoomBillingMode } from '@restaurant-qr/core';
import { RoomService } from '../../../services/RoomService';
import { X, Plus } from 'lucide-react';

interface AddRoomModalProps {
  tenantId: string;
  isMockMode: boolean;
  categories: RoomCategory[];
  onClose: () => void;
  onSuccess: () => void;
  roomToEdit?: any;
}

export const AddRoomModal: React.FC<AddRoomModalProps> = ({
  tenantId,
  isMockMode,
  categories,
  onClose,
  onSuccess,
  roomToEdit
}) => {
  const [roomNumber, setRoomNumber] = useState(roomToEdit?.roomNumber || '');
  const [roomName, setRoomName] = useState(roomToEdit?.roomName || '');
  const [categoryId, setCategoryId] = useState(roomToEdit?.categoryId || '');
  const [floor, setFloor] = useState<number>(roomToEdit?.floor !== undefined ? roomToEdit.floor : 1);
  const [zone, setZone] = useState(roomToEdit?.zone || '');
  const [capacity, setCapacity] = useState<number>(roomToEdit?.capacity !== undefined ? roomToEdit.capacity : 4);
  const [billingMode, setBillingMode] = useState<RoomBillingMode>(roomToEdit?.billingMode || 'FREE');
  const [basePrice, setBasePrice] = useState<number>(roomToEdit?.basePrice || 0);
  const [hourlyRate, setHourlyRate] = useState<number>(roomToEdit?.hourlyRate || 0);
  const [minimumSpend, setMinimumSpend] = useState<number>(roomToEdit?.minimumSpend || 0);
  const [serviceCharge, setServiceCharge] = useState<number>(roomToEdit?.serviceCharge || 0);
  const [notes, setNotes] = useState(roomToEdit?.notes || '');

  const [features, setFeatures] = useState<RoomFeature[]>(roomToEdit?.features || []);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);



  const availableFeatures: RoomFeature[] = [
    'AC',
    'TV',
    'Projector',
    'Music',
    'Smoking',
    'Non-Smoking',
    'Wheelchair Accessible'
  ];

  const handleFeatureToggle = (feature: RoomFeature) => {
    setFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomNumber.trim() || !roomName.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        roomNumber,
        roomName,
        categoryId: categoryId || undefined,
        floor,
        zone: zone || undefined,
        capacity,
        billingMode,
        basePrice: billingMode === 'FIXED' || billingMode === 'PACKAGE' ? basePrice : undefined,
        hourlyRate: billingMode === 'HOURLY' ? hourlyRate : undefined,
        minimumSpend: billingMode === 'MINIMUM_SPEND' ? minimumSpend : undefined,
        serviceCharge: serviceCharge || undefined,
        features,
        notes: notes || undefined
      };

      if (roomToEdit) {
        await RoomService.updateRoom(tenantId, roomToEdit.id, payload, isMockMode);
      } else {
        await RoomService.createRoom(tenantId, payload, isMockMode);
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save room.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Plus className="h-5 w-5 text-emerald-500" /> {roomToEdit ? 'Edit Restaurant Room' : 'Add Restaurant Room'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {error && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
                {error}
              </div>
            )}

            {/* Core Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Room Number / ID *</label>
                <input
                  type="text"
                  required
                  disabled={saving}
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. VIP-A"
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Room Name *</label>
                <input
                  type="text"
                  required
                  disabled={saving}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Imperial Lounge"
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Category (Optional)</label>
                <select
                  value={categoryId}
                  disabled={saving}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                >
                  <option value="">Select Category (None)</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Capacity (Guests)</label>
                <input
                  type="number"
                  min="1"
                  disabled={saving}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-400">Floor</label>
                <input
                  type="number"
                  min="0"
                  disabled={saving}
                  value={floor}
                  onChange={(e) => setFloor(Number(e.target.value))}
                  className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                />
              </div>
            </div>

            {/* Pricing & Billing */}
            <div className="border border-zinc-800 bg-zinc-950/40 p-4 rounded-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">Rental & Pricing Setup</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Billing Mode</label>
                  <select
                    value={billingMode}
                    disabled={saving}
                    onChange={(e) => setBillingMode(e.target.value as RoomBillingMode)}
                    className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                  >
                    <option value="FREE">Free (Order Only)</option>
                    <option value="MINIMUM_SPEND">Minimum Spend Limit</option>
                    <option value="HOURLY">Hourly Booking Rate</option>
                    <option value="FIXED">Fixed Entry Rate</option>
                    <option value="PACKAGE">Standard Room Package</option>
                  </select>
                </div>

                {billingMode === 'MINIMUM_SPEND' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 font-bold text-emerald-400">Minimum Spend (₹)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={saving}
                      value={minimumSpend}
                      onChange={(e) => setMinimumSpend(Number(e.target.value))}
                      className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl font-semibold disabled:opacity-50"
                    />
                  </div>
                )}

                {billingMode === 'HOURLY' && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 font-bold text-emerald-400">Hourly Rate (₹/hr)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={saving}
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(Number(e.target.value))}
                      className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl font-semibold disabled:opacity-50"
                    />
                  </div>
                )}

                {(billingMode === 'FIXED' || billingMode === 'PACKAGE') && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-zinc-400 font-bold text-emerald-400">Base Price (₹)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={saving}
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl font-semibold disabled:opacity-50"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Zone / Section Area</label>
                  <input
                    type="text"
                    disabled={saving}
                    value={zone}
                    onChange={(e) => setZone(e.target.value)}
                    placeholder="e.g. VIP Balcony"
                    className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400">Service Charge (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    disabled={saving}
                    value={serviceCharge}
                    onChange={(e) => setServiceCharge(Number(e.target.value))}
                    className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* Features Checklist */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block">Features & Amenities</label>
              <div className="flex flex-wrap gap-2">
                {availableFeatures.map((f) => {
                  const selected = features.includes(f);
                  return (
                    <button
                      type="button"
                      key={f}
                      disabled={saving}
                      onClick={() => handleFeatureToggle(f)}
                      className={`px-3.5 py-1.5 rounded-xl border text-xs font-medium transition ${
                        selected
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      } disabled:opacity-50`}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Internal Description / Notes</label>
              <textarea
                disabled={saving}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Enter special seating notes..."
                rows={3}
                className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl resize-none disabled:opacity-50"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-zinc-800 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-xl transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 disabled:text-zinc-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center gap-2"
            >
              {saving && (
                <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
              )}
              {saving 
                ? (roomToEdit ? 'Saving Changes...' : 'Creating Room...') 
                : (roomToEdit ? 'Save Changes' : 'Create Room')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
