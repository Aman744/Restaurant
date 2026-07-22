import React, { useState } from 'react';
import type { Room } from '@restaurant-qr/core';
import { RoomService } from '../../../services/RoomService';
import { X, Calendar } from 'lucide-react';

interface RoomReservationModalProps {
  tenantId: string;
  room: Room;
  isMockMode: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const RoomReservationModal: React.FC<RoomReservationModalProps> = ({
  tenantId,
  room,
  isMockMode,
  onClose,
  onSuccess
}) => {
  const [reservationName, setReservationName] = useState('');
  const [phone, setPhone] = useState('');
  const [guestsCount, setGuestsCount] = useState<number>(room.capacity);
  
  // Format current time + 1 hour as default start time
  const defaultStart = new Date(Date.now() + 60 * 60 * 1000);
  const defaultEnd = new Date(Date.now() + 3 * 60 * 60 * 1000); // 2 hours duration
  
  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const [startTime, setStartTime] = useState(toLocalISO(defaultStart));
  const [endTime, setEndTime] = useState(toLocalISO(defaultEnd));
  const [notes, setNotes] = useState('');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reservationName.trim() || !phone.trim() || !startTime || !endTime) {
      setError('Please fill in all required fields.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await RoomService.reserveRoom(
        tenantId,
        room.id,
        {
          reservationName,
          phone,
          guestsCount,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          notes: notes || undefined
        },
        isMockMode
      );
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to save reservation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-5 w-5 text-emerald-500" /> Book Room: {room.roomName}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">Customer Name *</label>
            <input
              type="text"
              required
              value={reservationName}
              onChange={(e) => setReservationName(e.target.value)}
              placeholder="e.g. Vikram Malhotra"
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">Contact Number *</label>
            <input
              type="text"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +91 98765 00123"
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">Start Time *</label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">End Time *</label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">Guest Count (Capacity: {room.capacity})</label>
            <input
              type="number"
              min="1"
              max={room.capacity}
              value={guestsCount}
              onChange={(e) => setGuestsCount(Number(e.target.value))}
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-zinc-400">Special Instructions / Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIP setup, corporate dining protocols..."
              rows={2}
              className="w-full border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl resize-none"
            />
          </div>

          {/* Pricing Summary */}
          {room.billingMode !== 'FREE' && (
            <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex justify-between items-center text-xs">
              <span className="text-zinc-400">Rate Plan / Billing:</span>
              <span className="font-bold text-emerald-400 uppercase tracking-wider">
                {room.billingMode.replace('_', ' ')}:
                {room.billingMode === 'HOURLY' && ` ₹${room.hourlyRate}/hr`}
                {room.billingMode === 'MINIMUM_SPEND' && ` Min ₹${room.minimumSpend}`}
                {(room.billingMode === 'FIXED' || room.billingMode === 'PACKAGE') && ` ₹${room.basePrice}`}
              </span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:bg-zinc-800 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition"
            >
              {saving ? 'Booking...' : 'Book Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
