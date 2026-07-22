import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { RoomStayRepository } from '@restaurant-qr/infra';
import { useRooms, useRoomCategories } from '../../../hooks/useRealtimeData';
import { RoomService } from '../../../services/RoomService';
import { AddRoomModal } from './AddRoomModal';
import { RoomReservationModal } from './RoomReservationModal';
import { RoomQrModal } from './RoomQrModal';
import { HousekeepingTasksTab } from './HousekeepingTasksTab';
import { RoomHistoryTab } from './RoomHistoryTab';
import { RoomServicesConfigTab } from './RoomServicesConfigTab';
import { 
  Plus, 
  Layers, 
  SlidersHorizontal, 
  LayoutGrid, 
  List, 
  DoorOpen, 
  Calendar, 
  UserCheck, 
  Trash2, 
  Wrench, 
  RefreshCw, 
  Check, 
  Volume2, 
  Sparkles,
  QrCode,
  History,
  Upload,
  Download,
  Edit,
  X
} from 'lucide-react';
import { db } from '../../../lib/firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';
import { useToast } from '../../../components/shared/ToastContext';
import type { RoomCategory, RoomFeature, RoomBillingMode } from '@restaurant-qr/core';

interface RoomsTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const RoomsTab: React.FC<RoomsTabProps> = ({ tenantId, isMockMode }) => {
  const { rooms, loading: roomsLoading } = useRooms(tenantId, isMockMode);
  const { categories, loading: catsLoading } = useRoomCategories(tenantId, isMockMode);
  const toast = useToast();
  const [pendingTasksCount, setPendingTasksCount] = useState(0);
  const [activeStays, setActiveStays] = useState<any[]>([]);
  const [activeGuests, setActiveGuests] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const updateData = async () => {
      try {
        let tasksList = [];
        let staysList = [];
        let guestsList = [];
        
        if (isMockMode) {
          const tasksStored = localStorage.getItem('restaurant_qr_mock_housekeeping_tasks_db');
          tasksList = tasksStored ? JSON.parse(tasksStored) : [];
          
          const staysStored = localStorage.getItem('restaurant_qr_mock_active_room_stays_db');
          staysList = staysStored ? JSON.parse(staysStored) : [];
          
          const guestsStored = localStorage.getItem('restaurant_qr_mock_stay_guests_db');
          guestsList = guestsStored ? JSON.parse(guestsStored) : [];
        } else {
          const repo = new RoomStayRepository(db);
          tasksList = await repo.listHousekeepingTasks(tenantId);
          
          const staysCol = collection(db, 'tenants', tenantId, 'active_room_stays');
          const staysSnap = await getDocs(staysCol);
          staysList = staysSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          const guestsCol = collection(db, 'tenants', tenantId, 'stay_guests');
          const guestsSnap = await getDocs(guestsCol);
          guestsList = guestsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        }
        
        if (active) {
          const pending = tasksList.filter((t: any) => t.status === 'pending' || t.status === 'in-progress');
          setPendingTasksCount(pending.length);
          setActiveStays(staysList);
          setActiveGuests(guestsList);
        }
      } catch (err) {
        console.error('Error fetching stays/guests:', err);
      }
    };

    updateData();
    const interval = setInterval(updateData, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [tenantId, isMockMode]);

  const handleExportRooms = () => {
    try {
      const headers = [
        'Room Number',
        'Room Name',
        'Category Name',
        'Capacity',
        'Floor',
        'Zone',
        'Billing Mode',
        'Base Price',
        'Hourly Rate',
        'Minimum Spend',
        'Service Charge',
        'Features',
        'Notes'
      ];
      
      const rows = rooms.map((r) => {
        const cat = categories.find((c) => c.id === r.categoryId)?.name || '';
        return [
          r.roomNumber,
          r.roomName,
          cat,
          r.capacity,
          r.floor,
          r.zone || '',
          r.billingMode,
          r.basePrice || 0,
          r.hourlyRate || 0,
          r.minimumSpend || 0,
          r.serviceCharge || 0,
          (r.features || []).join(';'),
          r.notes || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map((row) => row.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `rooms_export_${tenantId}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Rooms list exported successfully as CSV.');
    } catch (e: any) {
      toast.error(`Export failed: ${e.message}`);
    }
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      try {
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (lines.length <= 1) {
          toast.error('CSV file is empty or missing data rows.');
          return;
        }

        // Header index parsing
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const getIdx = (name: string) => headers.indexOf(name.toLowerCase());

        const numIdx = getIdx('Room Number');
        const nameIdx = getIdx('Room Name');
        const catIdx = getIdx('Category Name');
        const capIdx = getIdx('Capacity');
        const floorIdx = getIdx('Floor');
        const zoneIdx = getIdx('Zone');
        const modeIdx = getIdx('Billing Mode');
        const baseIdx = getIdx('Base Price');
        const hrIdx = getIdx('Hourly Rate');
        const minIdx = getIdx('Minimum Spend');
        const scIdx = getIdx('Service Charge');
        const featIdx = getIdx('Features');
        const notesIdx = getIdx('Notes');

        if (numIdx === -1 || nameIdx === -1) {
          toast.error('CSV must contain at least "Room Number" and "Room Name" columns.');
          return;
        }

        let importCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const rawCols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || lines[i].split(',');
          const cols = rawCols.map(c => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

          const roomNumber = cols[numIdx];
          const roomName = cols[nameIdx];
          if (!roomNumber || !roomName) continue;

          // Find or create category
          const categoryName = catIdx !== -1 ? cols[catIdx] : 'General';
          let cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
          let finalCatId = '';

          if (!cat) {
            const newCatId = `cat_${tenantId}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const newCat: RoomCategory = {
              id: newCatId,
              tenantId,
              name: categoryName,
              isActive: true,
              createdAt: new Date()
            };
            if (isMockMode) {
              const stored = localStorage.getItem('restaurant_qr_mock_room_categories_db');
              const list = stored ? JSON.parse(stored) : [];
              list.push(newCat);
              localStorage.setItem('restaurant_qr_mock_room_categories_db', JSON.stringify(list));
            } else {
              await addDoc(collection(db, 'tenants', tenantId, 'room_categories'), newCat);
            }
            finalCatId = newCatId;
          } else {
            finalCatId = cat.id;
          }

          const capacity = capIdx !== -1 ? Number(cols[capIdx]) || 4 : 4;
          const floor = floorIdx !== -1 ? Number(cols[floorIdx]) || 0 : 0;
          const zone = zoneIdx !== -1 ? cols[zoneIdx] : undefined;
          const billingMode = (modeIdx !== -1 ? cols[modeIdx].toUpperCase() : 'FREE') as RoomBillingMode;
          const basePrice = baseIdx !== -1 ? Number(cols[baseIdx]) || 0 : undefined;
          const hourlyRate = hrIdx !== -1 ? Number(cols[hrIdx]) || 0 : undefined;
          const minimumSpend = minIdx !== -1 ? Number(cols[minIdx]) || 0 : undefined;
          const serviceCharge = scIdx !== -1 ? Number(cols[scIdx]) || 0 : undefined;
          const features = featIdx !== -1 && cols[featIdx] ? cols[featIdx].split(';') as RoomFeature[] : [];
          const notes = notesIdx !== -1 ? cols[notesIdx] : undefined;

          await RoomService.createRoom(
            tenantId,
            {
              roomNumber,
              roomName,
              categoryId: finalCatId,
              floor,
              zone,
              capacity,
              billingMode,
              basePrice,
              hourlyRate,
              minimumSpend,
              serviceCharge,
              features,
              notes
            },
            isMockMode
          );
          importCount++;
        }
        toast.success(`Successfully imported ${importCount} rooms from CSV.`);
        setTimeout(() => window.location.reload(), 1500);
      } catch (err: any) {
        toast.error(`CSV parsing error: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Sub-tabs navigation state
  const [subTab, setSubTab] = useState<'rooms' | 'housekeeping' | 'history' | 'services'>('rooms');
  const location = useLocation();

  useEffect(() => {
    if (location.hash === '#housekeeping') {
      setSubTab('housekeeping');
    } else if (location.hash === '#history') {
      setSubTab('history');
    } else if (location.hash === '#rooms') {
      setSubTab('rooms');
    } else if (location.hash === '#services') {
      setSubTab('services');
    }
  }, [location.hash]);

  // Filters
  const [selectedCat, setSelectedCat] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<any | null>(null);
  const [roomToEdit, setRoomToEdit] = useState<any | null>(null);
  const [viewingQrRoom, setViewingQrRoom] = useState<any | null>(null);
  const [checkingInRoom, setCheckingInRoom] = useState<any | null>(null);
  
  // Category adder
  const [newCatName, setNewCatName] = useState('');
  const [showCatAdder, setShowCatAdder] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    setAddingCat(true);
    try {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_categories_db');
        const list = stored ? JSON.parse(stored) : [];
        const newCat = {
          id: `cat_${tenantId}_${Date.now()}`,
          tenantId,
          name: newCatName.trim(),
          isActive: true,
          createdAt: new Date()
        };
        list.push(newCat);
        localStorage.setItem('restaurant_qr_mock_room_categories_db', JSON.stringify(list));
      } else {
        await addDoc(collection(db, 'tenants', tenantId, 'room_categories'), {
          tenantId,
          name: newCatName.trim(),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      setNewCatName('');
      setShowCatAdder(false);
      // Reload is handled by hook subscription
    } catch (e) {
      console.error(e);
    } finally {
      setAddingCat(false);
    }
  };

  const getCategoryName = (catId?: string) => {
    if (!catId) return 'Uncategorized';
    const match = categories.find((c) => c.id === catId);
    return match ? match.name : 'Uncategorized';
  };

  // Status color helpers
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5';
      case 'reserved':
        return 'border-amber-500/20 text-amber-400 bg-amber-500/5';
      case 'checked-in':
        return 'border-blue-500/20 text-blue-400 bg-blue-500/5';
      case 'occupied':
        return 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5';
      case 'bill-open':
        return 'border-pink-500/20 text-pink-400 bg-pink-500/5';
      case 'checkout':
        return 'border-violet-500/20 text-violet-400 bg-violet-500/5';
      case 'cleaning':
        return 'border-purple-500/20 text-purple-400 bg-purple-500/5';
      case 'inspection':
        return 'border-sky-500/20 text-sky-400 bg-sky-500/5';
      case 'maintenance':
        return 'border-red-500/20 text-red-400 bg-red-500/5';
      default:
        return 'border-zinc-800 text-zinc-400 bg-zinc-900/40';
    }
  };

  // Filtered rooms list
  const filteredRooms = rooms.filter((r) => {
    if (selectedCat !== 'ALL' && r.categoryId !== selectedCat) return false;
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    return true;
  });

  const loading = roomsLoading || catsLoading;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-xs">Loading rooms data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-emerald-500" /> Rooms Dashboard
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-end md:self-auto">
          <label className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl transition flex items-center gap-2 cursor-pointer select-none">
            <Upload className="h-4 w-4 text-zinc-400" /> Import CSV
            <input
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              className="hidden"
            />
          </label>
          <button
            onClick={handleExportRooms}
            className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl transition flex items-center gap-2"
          >
            <Download className="h-4 w-4 text-zinc-400" /> Export CSV
          </button>
          <button
            onClick={() => setShowCatAdder(!showCatAdder)}
            className="px-4 py-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-300 text-xs font-semibold rounded-xl transition flex items-center gap-2"
          >
            <Layers className="h-4 w-4 text-zinc-400" /> Categories Manager
          </button>
          <button
            onClick={() => {
              setRoomToEdit(null);
              setShowAddRoom(true);
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Provision Room
          </button>
        </div>
      </div>

      {/* Sub-tab navigation bar */}
      <div className="flex border-b border-zinc-800">
        <button
          type="button"
          onClick={() => setSubTab('rooms')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            subTab === 'rooms' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <DoorOpen className="h-4 w-4" /> Rooms Dashboard
        </button>
        <button
          type="button"
          onClick={() => setSubTab('housekeeping')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            subTab === 'housekeeping' ? 'border-emerald-500 text-emerald-400 font-extrabold' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <Sparkles className="h-4 w-4" /> 
          <span>Housekeeping Tasks</span>
          {pendingTasksCount > 0 && (
            <span className="text-[10px] font-black bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse ml-1.5 shadow-md shadow-red-500/20">
              {pendingTasksCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('history')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            subTab === 'history' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <History className="h-4 w-4" /> Stays History logs
        </button>
        <button
          type="button"
          onClick={() => setSubTab('services')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
            subTab === 'services' ? 'border-emerald-500 text-emerald-400 font-extrabold' : 'border-transparent text-zinc-400 hover:text-white'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" /> Room Services
        </button>
      </div>

      {subTab === 'housekeeping' && (
        <HousekeepingTasksTab tenantId={tenantId} isMockMode={isMockMode} />
      )}

      {subTab === 'history' && (
        <RoomHistoryTab tenantId={tenantId} isMockMode={isMockMode} />
      )}

      {subTab === 'services' && (
        <RoomServicesConfigTab tenantId={tenantId} isMockMode={isMockMode} />
      )}

      {subTab === 'rooms' && (
        <>
          {/* Category Adder Form Inline */}
          {showCatAdder && (
        <form onSubmit={handleAddCategory} className="p-4 border border-zinc-800 bg-zinc-900/20 rounded-2xl flex items-center gap-3 max-w-md animate-in fade-in duration-200">
          <input
            type="text"
            required
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="e.g. Wine Lounge, Rooftop Cabana"
            className="flex-1 border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
          />
          <button
            type="submit"
            disabled={addingCat}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-semibold rounded-xl transition whitespace-nowrap"
          >
            {addingCat ? 'Adding...' : 'Add Category'}
          </button>
        </form>
      )}

      {/* Filters Bar */}
      <div className="p-4 border border-zinc-900 bg-zinc-900/20 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-zinc-500" />
            <span className="text-xs text-zinc-400 font-semibold">Filters:</span>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCat}
            onChange={(e) => setSelectedCat(e.target.value)}
            className="border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="border border-zinc-800 bg-zinc-950 text-zinc-300 text-xs px-3 py-2.5 rounded-xl focus:outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
            <option value="checked-in">Checked-In</option>
            <option value="occupied">Occupied</option>
            <option value="bill-open">Bill Open</option>
            <option value="checkout">Checkout</option>
            <option value="cleaning">Cleaning</option>
            <option value="inspection">Inspection</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-zinc-950 border border-zinc-900 p-1 rounded-xl self-end sm:self-auto">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'grid' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'list' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Empty State */}
      {filteredRooms.length === 0 && (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-3xl space-y-3">
          <DoorOpen className="h-10 w-10 text-zinc-600 mx-auto" />
          <h3 className="text-sm font-bold text-zinc-300">No Rooms Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try adjusting your category filters or provision a new private room space above.
          </p>
        </div>
      )}

      {/* Rooms Presentation List / Grid */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRooms.map((room) => (
            <div
              key={room.id}
              className="border border-zinc-900 hover:border-zinc-800 bg-zinc-900/10 rounded-3xl p-5 space-y-4 hover:shadow-xl hover:shadow-zinc-950/20 transition flex flex-col justify-between"
            >
              {/* Header Info */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                      {getCategoryName(room.categoryId)}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-0.5">
                      {room.roomName} <span className="text-zinc-500 font-semibold text-xs ml-1">({room.roomNumber})</span>
                    </h3>
                  </div>

                  <span className={`text-[10px] font-bold uppercase border px-2.5 py-1.5 rounded-xl tracking-wider ${getStatusColor(room.status)}`}>
                    {room.status}
                  </span>
                </div>

                {/* Specific features */}
                <div className="flex flex-wrap gap-1">
                  {room.features.slice(0, 4).map((f) => (
                    <span key={f} className="text-[9px] font-medium px-2 py-0.5 bg-zinc-950 border border-zinc-900 text-zinc-400 rounded-lg">
                      {f}
                    </span>
                  ))}
                  {room.features.length > 4 && (
                    <span className="text-[9px] font-medium px-2 py-0.5 bg-zinc-950 border border-zinc-900 text-zinc-500 rounded-lg">
                      +{room.features.length - 4} more
                    </span>
                  )}
                </div>

                {/* Telemetry info */}
                <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-zinc-900/60">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 font-medium block">Capacity / Floor</span>
                    <span className="text-zinc-300 font-bold">{room.capacity} Pax / F{room.floor || 1}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-zinc-500 font-medium block">Billing Mode</span>
                    <span className="text-emerald-400 font-black uppercase text-[10px]">
                      {room.billingMode.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {/* Active check-in guest details */}
                {(() => {
                  if (!['checked-in', 'occupied', 'bill-open', 'checkout'].includes(room.status)) return null;
                  const stay = activeStays.find((s) => s.id === room.activeStayId);
                  if (!stay) return null;
                  const guests = activeGuests.filter((g) => g.stayId === stay.id);
                  const primaryGuest = guests.find((g) => g.role === 'Primary') || guests[0];
                  
                  return (
                    <div className="bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3 space-y-2 text-xs animate-in fade-in duration-200">
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                        <span>Check-In Details</span>
                        <span className="font-mono text-[9px] text-emerald-400">{stay.id}</span>
                      </div>
                      {primaryGuest && (
                        <div className="space-y-1">
                          <div className="text-zinc-200 font-bold">{primaryGuest.name}</div>
                          {primaryGuest.phone && (
                            <div className="text-[10px] text-zinc-400">📞 {primaryGuest.phone}</div>
                          )}
                          {primaryGuest.email && (
                            <div className="text-[10px] text-zinc-400">✉️ {primaryGuest.email}</div>
                          )}
                        </div>
                      )}
                      <div className="flex justify-between items-center text-[9px] text-zinc-500 font-mono">
                        <span>IN: {stay.checkInDate} {stay.checkInTime}</span>
                        {guests.length > 1 && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-sans font-bold">
                            +{guests.length - 1} Guests
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Operations based on state machine */}
              <div className="pt-4 border-t border-zinc-900/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* FSM state controls */}
                  {room.status === 'available' && (
                    <>
                      <button
                        onClick={() => setBookingRoom(room)}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                      >
                        <Calendar className="h-3.5 w-3.5" /> Book
                      </button>
                      <button
                        onClick={() => setCheckingInRoom(room)}
                        className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Check-in
                      </button>
                    </>
                  )}

                  {room.status === 'reserved' && (
                    <button
                      onClick={() => setCheckingInRoom(room)}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Check-in
                    </button>
                  )}

                  {(room.status === 'checked-in' || room.status === 'occupied') && (
                    <button
                      onClick={() => RoomService.checkOutGuest(tenantId, room.id, isMockMode)}
                      className="px-3.5 py-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checkout
                    </button>
                  )}

                  {room.status === 'checkout' && (
                    <button
                      onClick={() => RoomService.updateRoomStatus(tenantId, room.id, 'cleaning', isMockMode)}
                      className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Sparkles className="h-3.5 w-3.5" /> Clean
                    </button>
                  )}

                  {room.status === 'cleaning' && (
                    <button
                      onClick={() => RoomService.updateRoomStatus(tenantId, room.id, 'inspection', isMockMode)}
                      className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Volume2 className="h-3.5 w-3.5" /> Inspect
                    </button>
                  )}

                  {room.status === 'inspection' && (
                    <button
                      onClick={() => RoomService.updateRoomStatus(tenantId, room.id, 'available', isMockMode)}
                      className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      <Check className="h-3.5 w-3.5" /> Approve
                    </button>
                  )}

                  {room.status === 'maintenance' && (
                    <button
                      onClick={() => RoomService.updateRoomStatus(tenantId, room.id, 'available', isMockMode)}
                      className="px-3.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition"
                    >
                      Restore available
                    </button>
                  )}

                  {/* View QR Trigger */}
                  <button
                    type="button"
                    onClick={() => setViewingQrRoom(room)}
                    className="p-2 border border-zinc-800 hover:border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-200 rounded-xl transition"
                    title="View Room QR Code Options"
                  >
                    <QrCode className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {room.status !== 'maintenance' && (
                    <button
                      onClick={() => RoomService.updateRoomStatus(tenantId, room.id, 'maintenance', isMockMode)}
                      className="p-2 border border-zinc-900 bg-zinc-950 text-red-500/70 hover:text-red-400 rounded-xl hover:bg-zinc-900 transition"
                      title="Mark Maintenance"
                    >
                      <Wrench className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setRoomToEdit(room);
                      setShowAddRoom(true);
                    }}
                    className="p-2 border border-zinc-900 bg-zinc-950 text-emerald-500/70 hover:text-emerald-400 rounded-xl hover:bg-zinc-900 transition"
                    title="Edit Room Details"
                  >
                    <Edit className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => {
                      if (window.confirm('Delete this room? All history and data will be removed.')) {
                        RoomService.deleteRoom(tenantId, room.id, isMockMode);
                      }
                    }}
                    className="p-2 border border-zinc-900 bg-zinc-950 text-red-500/70 hover:text-red-400 rounded-xl hover:bg-zinc-900 transition"
                    title="Delete Room Space"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List Layout Table */
        <div className="border border-zinc-900 bg-zinc-900/10 rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-xs text-zinc-500 uppercase font-black tracking-wider bg-zinc-950/40">
                  <th className="p-4">Room No / Name</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Billing Mode</th>
                  <th className="p-4 text-center">Capacity</th>
                  <th className="p-4 text-center">Floor / Zone</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60 text-xs">
                {filteredRooms.map((room) => (
                  <tr key={room.id} className="hover:bg-zinc-900/5 transition">
                    <td className="p-4">
                      <div className="font-bold text-white">{room.roomName}</div>
                      <div className="text-zinc-500 text-[10px] mt-0.5">{room.roomNumber}</div>
                      {(() => {
                        if (!['checked-in', 'occupied', 'bill-open', 'checkout'].includes(room.status)) return null;
                        const stay = activeStays.find((s) => s.id === room.activeStayId);
                        if (!stay) return null;
                        const guests = activeGuests.filter((g) => g.stayId === stay.id);
                        const primaryGuest = guests.find((g) => g.role === 'Primary') || guests[0];
                        if (!primaryGuest) return null;
                        return (
                          <div className="text-[10px] text-zinc-400 mt-1 bg-zinc-950/40 p-2 rounded-xl border border-zinc-900/60 max-w-[200px]">
                            <span className="font-bold text-zinc-300 block truncate">{primaryGuest.name}</span>
                            {primaryGuest.phone && <span className="text-[9px] text-zinc-500 block mt-0.5">📞 {primaryGuest.phone}</span>}
                            {guests.length > 1 && (
                              <span className="text-[8px] font-bold text-emerald-400 block mt-0.5">+{guests.length - 1} extra guests</span>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-zinc-300 font-semibold">{getCategoryName(room.categoryId)}</td>
                    <td className="p-4 text-emerald-400 font-bold uppercase tracking-wider">{room.billingMode.replace('_', ' ')}</td>
                    <td className="p-4 text-center text-zinc-300 font-bold">{room.capacity} Pax</td>
                    <td className="p-4 text-center text-zinc-400">F{room.floor || 1} / {room.zone || 'Main'}</td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold uppercase border px-2 py-0.5 rounded-lg ${getStatusColor(room.status)}`}>
                        {room.status}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-1.5">
                      {room.status === 'available' && (
                        <button
                          onClick={() => setCheckingInRoom(room)}
                          className="px-2 py-1 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-600 transition"
                        >
                          Check-in
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setViewingQrRoom(room)}
                        className="px-2 py-1 bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-[10px] font-bold rounded-lg transition"
                      >
                        QR Link
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRoomToEdit(room);
                          setShowAddRoom(true);
                        }}
                        className="px-2 py-1 bg-zinc-800 text-emerald-400 text-[10px] font-bold rounded-lg hover:bg-zinc-750 transition animate-in duration-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Delete this room?')) {
                            RoomService.deleteRoom(tenantId, room.id, isMockMode);
                          }
                        }}
                        className="px-2 py-1 bg-zinc-800 text-red-400 text-[10px] font-bold rounded-lg hover:bg-zinc-750 transition"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </>)}

      {/* Create / Edit Room Form Modal */}
      {showAddRoom && (
        <AddRoomModal
          tenantId={tenantId}
          isMockMode={isMockMode}
          categories={categories}
          roomToEdit={roomToEdit}
          onClose={() => {
            setShowAddRoom(false);
            setRoomToEdit(null);
          }}
          onSuccess={() => {
            setShowAddRoom(false);
            setRoomToEdit(null);
            toast.success(roomToEdit ? 'Room updated successfully.' : 'Room created successfully.');
          }}
        />
      )}

      {/* Book Room Modal */}
      {bookingRoom && (
        <RoomReservationModal
          tenantId={tenantId}
          room={bookingRoom}
          isMockMode={isMockMode}
          onClose={() => setBookingRoom(null)}
          onSuccess={() => setBookingRoom(null)}
        />
      )}

      {/* Room QR Modal */}
      {viewingQrRoom && (
        <RoomQrModal
          tenantId={tenantId}
          room={viewingQrRoom}
          onClose={() => setViewingQrRoom(null)}
        />
      )}

      {/* Check In Room Modal */}
      {checkingInRoom && (() => {
        const [name, setName] = useState('');
        const [phone, setPhone] = useState('');
        const [email, setEmail] = useState('');
        const [guestsCount, setGuestsCount] = useState(2);
        const [purpose, setPurpose] = useState('Private Dining');
        const [notes, setNotes] = useState('');
        const [submitting, setSubmitting] = useState(false);

        const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!name.trim()) return;
          setSubmitting(true);
          try {
            await RoomService.checkInRoom(tenantId, checkingInRoom.id, isMockMode, {
              name: name.trim(),
              phone: phone.trim() || 'Staff Check-In',
              email: email.trim() || undefined,
              guestsCount: Number(guestsCount) || 2,
              purpose: purpose.trim(),
              notes: notes.trim() || undefined
            });
            toast.success(`Successfully checked in ${name} to Room ${checkingInRoom.roomNumber}!`);
            setCheckingInRoom(null);
            setTimeout(() => window.location.reload(), 1000);
          } catch (err: any) {
            toast.error(`Check-in failed: ${err.message}`);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white space-y-6 relative">
              <button
                type="button"
                onClick={() => setCheckingInRoom(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="border-b border-zinc-850 pb-3">
                <h3 className="text-base font-extrabold text-white">Staff Guest Check-In</h3>
                <p className="text-xs text-zinc-400 mt-1">Room {checkingInRoom.roomNumber} ({checkingInRoom.roomName})</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Primary Guest Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Rohini Sharma"
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. guest@example.com"
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Number of Guests</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={guestsCount}
                      onChange={(e) => setGuestsCount(Number(e.target.value))}
                      className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Purpose</label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. Dining"
                      className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Special requests or notes..."
                    rows={2}
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl resize-none"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckingInRoom(null)}
                    className="flex-1 py-2.5 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {submitting ? 'Checking In...' : 'Confirm Check-In'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
