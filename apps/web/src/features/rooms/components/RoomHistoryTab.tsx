import React, { useState, useEffect } from 'react';
import { Sparkles, Search, X, Star } from 'lucide-react';
import { db } from '../../../lib/firebase.js';
import { RoomStayRepository } from '@restaurant-qr/infra';

interface RoomHistoryTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const RoomHistoryTab: React.FC<RoomHistoryTabProps> = ({ tenantId, isMockMode }) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('ALL');

  // Detail Modal
  const [selectedStay, setSelectedStay] = useState<any | null>(null);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_history_db');
        if (!stored) {
          // Pre-seed mock history data for the dashboard to look premium and fully-populated
          const mockHist = [
            {
              id: 'STAY-20260720-0042',
              roomId: 'room_001',
              roomNumber: '001',
              roomName: 'Suite Room 101',
              checkInDate: '2026-07-20',
              checkInTime: '14:00',
              checkOutDate: '2026-07-21',
              checkOutTime: '11:30',
              status: 'checked-out',
              foodCharges: 1450,
              roomCharges: 3500,
              tax: 891,
              grandTotal: 5841,
              guests: [
                { id: 'g1', name: 'Rohan Sharma', phone: '9876543210', role: 'Primary', status: 'Approved' },
                { id: 'g2', name: 'Priya Sharma', phone: '9876543211', role: 'Guest', status: 'Approved' }
              ],
              timeline: [
                { id: 't1', timestamp: '2026-07-20T14:00:00Z', action: 'CHECK_IN', actor: 'customer', metadata: { guestName: 'Rohan Sharma' } },
                { id: 't2', timestamp: '2026-07-20T14:15:00Z', action: 'JOIN_APPROVED', actor: 'staff', metadata: { guestName: 'Priya Sharma' } },
                { id: 't3', timestamp: '2026-07-20T20:30:00Z', action: 'ORDER_PLACED', actor: 'customer', metadata: { totalAmount: 1450 } },
                { id: 't4', timestamp: '2026-07-21T11:30:00Z', action: 'PAYMENT', actor: 'customer' },
                { id: 't5', timestamp: '2026-07-21T11:35:00Z', action: 'CHECK_OUT', actor: 'customer' }
              ]
            },
            {
              id: 'STAY-20260721-0089',
              roomId: 'room_f7f50bf86ef6',
              roomNumber: 'F7F5',
              roomName: 'Imperial Cabin',
              checkInDate: '2026-07-21',
              checkInTime: '18:15',
              checkOutDate: '2026-07-22',
              checkOutTime: '08:45',
              status: 'checked-out',
              foodCharges: 2100,
              roomCharges: 500,
              tax: 468,
              grandTotal: 3068,
              guests: [
                { id: 'g3', name: 'Ananya Goel', phone: '9999888877', role: 'Primary', status: 'Approved' }
              ],
              timeline: [
                { id: 't6', timestamp: '2026-07-21T18:15:00Z', action: 'CHECK_IN', actor: 'customer', metadata: { guestName: 'Ananya Goel' } },
                { id: 't7', timestamp: '2026-07-21T19:00:00Z', action: 'ORDER_PLACED', actor: 'customer', metadata: { totalAmount: 2100 } },
                { id: 't8', timestamp: '2026-07-22T08:45:00Z', action: 'CHECK_OUT', actor: 'customer' }
              ]
            }
          ];
          localStorage.setItem('restaurant_qr_mock_room_history_db', JSON.stringify(mockHist));
          setHistory(mockHist);
        } else {
          setHistory(JSON.parse(stored));
        }
      } else {
        const repo = new RoomStayRepository(db);
        const data = await repo.listHistory(tenantId);
        setHistory(data);
      }
    } catch (err) {
      console.error('Failed to load stays history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [tenantId, isMockMode]);

  // Unique rooms in history
  const uniqueRooms = Array.from(new Set(history.map((h) => h.roomId))).map((id) => {
    const matched = history.find((h) => h.roomId === id);
    return { id, name: matched?.roomName || matched?.roomNumber || 'Unknown Room' };
  });

  // Calculate Metrics
  const filteredHistory = history.filter((h) => {
    const matchesSearch =
      h.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.guests?.some((g: any) => g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.phone.includes(searchQuery));
    const matchesRoom = selectedRoomId === 'ALL' || h.roomId === selectedRoomId;
    return matchesSearch && matchesRoom;
  });

  const totalFoodRevenue = filteredHistory.reduce((sum, h) => sum + (h.foodCharges || 0), 0);
  const totalRoomRevenue = filteredHistory.reduce((sum, h) => sum + (h.roomCharges || 0), 0);
  const grandTotalRevenue = filteredHistory.reduce((sum, h) => sum + (h.grandTotal || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-zinc-400 text-xs font-semibold">
        Loading stay histories...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-extrabold text-white">Stays History & Telemetry</h2>
        <p className="text-xs text-zinc-400">View permanent archived guest check-in timeline records, order totals, and invoice breakdowns.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-2xl">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Total Stays</p>
          <p className="text-xl font-extrabold text-white mt-1">{filteredHistory.length}</p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-2xl">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Food Revenue</p>
          <p className="text-xl font-extrabold text-white mt-1">₹{totalFoodRevenue}</p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-2xl">
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Room Revenue</p>
          <p className="text-xl font-extrabold text-white mt-1">₹{totalRoomRevenue}</p>
        </div>
        <div className="border border-zinc-800 bg-zinc-900/40 p-4 rounded-2xl">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider text-emerald-400">Grand Total</p>
          <p className="text-xl font-extrabold text-emerald-400 mt-1">₹{grandTotalRevenue}</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Stay ID, Guest Name or Mobile..."
            className="w-full pl-10 pr-4 py-2 bg-zinc-950 border border-zinc-850 rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-white"
          />
        </div>
        <select
          value={selectedRoomId}
          onChange={(e) => setSelectedRoomId(e.target.value)}
          className="border border-zinc-850 bg-zinc-950 text-zinc-300 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-emerald-500"
        >
          <option value="ALL">All Rooms</option>
          {uniqueRooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Stays Grid/Table */}
      {filteredHistory.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 text-xs font-medium space-y-2">
          <Sparkles className="h-6 w-6 text-zinc-600 mx-auto" />
          <p>No historical stays found matching your filter parameters.</p>
        </div>
      ) : (
        <div className="border border-zinc-800 bg-zinc-950 rounded-2xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900 text-zinc-400 font-bold border-b border-zinc-800">
                <tr>
                  <th className="p-4">Stay ID</th>
                  <th className="p-4">Room</th>
                  <th className="p-4">Primary Guest</th>
                  <th className="p-4">Check-In</th>
                  <th className="p-4">Check-Out</th>
                  <th className="p-4 text-right">Invoice Total</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {filteredHistory.map((stay) => {
                  const primaryGuest = stay.guests?.find((g: any) => g.role === 'Primary') || stay.guests?.[0] || { name: 'Guest', phone: '' };
                  return (
                    <tr key={stay.id} className="hover:bg-zinc-900/40 transition">
                      <td className="p-4 font-mono font-bold text-white">{stay.id}</td>
                      <td className="p-4">{stay.roomNumber} ({stay.roomName})</td>
                      <td className="p-4">
                        <div className="font-bold text-white">{primaryGuest.name}</div>
                        <div className="text-[10px] text-zinc-500">{primaryGuest.phone}</div>
                      </td>
                      <td className="p-4">{stay.checkInDate} {stay.checkInTime}</td>
                      <td className="p-4">{stay.checkOutDate} {stay.checkOutTime}</td>
                      <td className="p-4 text-right text-emerald-400 font-bold">₹{stay.grandTotal}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => setSelectedStay(stay)}
                          className="px-2.5 py-1.5 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 hover:bg-zinc-750 text-white rounded-lg transition"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal overlay */}
      {selectedStay && (() => {
        // Load feedback if any
        let feedback: any = null;
        if (isMockMode) {
          const stored = localStorage.getItem('restaurant_qr_mock_room_feedback_db');
          if (stored) {
            const list = JSON.parse(stored);
            feedback = list.find((f: any) => f.stayId === selectedStay.id);
          }
        }
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white space-y-6 relative max-h-[85vh] overflow-y-auto">
              <button
                onClick={() => setSelectedStay(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="border-b border-zinc-850 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                    Archived Stay
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="font-mono text-zinc-400 font-bold">{selectedStay.id}</span>
                </div>
                <h3 className="text-lg font-black text-white mt-1">Room {selectedStay.roomNumber} ({selectedStay.roomName})</h3>
              </div>

              {/* Guest lists & Invoice grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Stay Info */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Stay Timeline</h4>
                    <div className="space-y-2 mt-2">
                      {selectedStay.timeline?.map((evt: any) => (
                        <div key={evt.id} className="flex gap-2 text-[10px] text-zinc-400">
                          <span className="font-mono font-bold text-zinc-500">{evt.timestamp}</span>
                          <div>
                            <span className="font-bold text-white">{evt.action}</span> by <span className="text-zinc-500 font-bold capitalize">{evt.actor}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[10px] font-black uppercase text-zinc-500 tracking-wider mt-2">Checked-in Guests</h4>
                    <div className="space-y-1.5 mt-2">
                      {selectedStay.guests?.map((g: any) => (
                        <div key={g.id} className="flex justify-between items-center text-[11px] border-b border-zinc-900 pb-1">
                          <span className="text-zinc-300 font-bold">{g.name} <span className="text-[8px] font-bold text-zinc-500">{g.role}</span></span>
                          <span className="text-zinc-500">{g.phone}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Billing Summary */}
                <div className="space-y-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-850">
                  <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-800 pb-1">Final Invoice Settlement</h4>
                  <div className="space-y-2 text-xs font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Room Rental Charges:</span>
                      <span className="text-white">₹{selectedStay.roomCharges}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Food Orders Total:</span>
                      <span className="text-white">₹{selectedStay.foodCharges}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-zinc-500">
                      <span>Service Taxes (18%):</span>
                      <span>₹{selectedStay.tax}</span>
                    </div>
                    <div className="flex justify-between text-sm font-black border-t border-dashed border-zinc-800 pt-2 text-white">
                      <span className="text-emerald-400">Total Settled:</span>
                      <span className="text-emerald-400">₹{selectedStay.grandTotal}</span>
                    </div>
                  </div>

                  {feedback && (
                    <div className="border-t border-zinc-800 pt-3 space-y-2">
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Guest Feedback</h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">Room:</span>
                          <div className="flex text-amber-400">
                            {Array.from({ length: feedback.ratings?.room || 5 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">Food:</span>
                          <div className="flex text-amber-400">
                            {Array.from({ length: feedback.ratings?.food || 5 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-zinc-400">Service:</span>
                          <div className="flex text-amber-400">
                            {Array.from({ length: feedback.ratings?.service || 5 }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-amber-400" />
                            ))}
                          </div>
                        </div>
                        {feedback.comment && (
                          <div className="text-[10px] text-zinc-300 italic mt-1 bg-zinc-950 p-2 rounded-lg border border-zinc-850">
                            "{feedback.comment}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
