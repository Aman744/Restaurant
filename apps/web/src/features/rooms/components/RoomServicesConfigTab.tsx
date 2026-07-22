import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useToast } from '../../../components/shared/ToastContext';
import { Sparkles, Plus, Edit, Trash2, Check, RefreshCw, X, Eye, EyeOff } from 'lucide-react';

interface RoomServiceItem {
  id: string;
  tenantId: string;
  name: string;
  category: 'amenity' | 'laundry' | 'wellness' | 'concierge' | 'convenience';
  description: string;
  price?: number | null;
  options?: string[] | null;
  isActive: boolean;
  createdAt: string;
}

interface RoomServicesConfigTabProps {
  tenantId: string;
  isMockMode: boolean;
}

export const RoomServicesConfigTab: React.FC<RoomServicesConfigTabProps> = ({ tenantId, isMockMode }) => {
  const toast = useToast();
  const [services, setServices] = useState<RoomServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal / Form States
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<RoomServiceItem | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [category, setCategory] = useState<RoomServiceItem['category']>('amenity');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState<string>('');
  const [optionsStr, setOptionsStr] = useState<string>(''); // comma-separated options
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Wi-Fi Config States
  const [wifiSsid, setWifiSsid] = useState('Grand_Palace_Premium');
  const [wifiPass, setWifiPass] = useState('welcome_to_paradise');
  const [savingWifi, setSavingWifi] = useState(false);

  // Load WiFi Config
  useEffect(() => {
    let active = true;
    const fetchWifi = async () => {
      try {
        if (isMockMode) {
          const stored = localStorage.getItem('restaurant_qr_mock_room_wifi_db');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (active) {
              setWifiSsid(parsed.ssid || 'Grand_Palace_Premium');
              setWifiPass(parsed.pass || 'welcome_to_paradise');
            }
          }
        } else {
          const wifiDocRef = doc(db, 'tenants', tenantId, 'room_configs', 'wifi');
          const snap = await getDoc(wifiDocRef);
          if (snap.exists() && active) {
            const data = snap.data();
            setWifiSsid(data.ssid || 'Grand_Palace_Premium');
            setWifiPass(data.pass || 'welcome_to_paradise');
          }
        }
      } catch (err) {
        console.error('Failed to load wifi config:', err);
      }
    };
    fetchWifi();
    return () => { active = false; };
  }, [tenantId, isMockMode]);

  const handleSaveWifi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wifiSsid.trim() || !wifiPass.trim()) {
      toast.error('SSID and Password cannot be empty!');
      return;
    }
    setSavingWifi(true);
    try {
      if (isMockMode) {
        localStorage.setItem('restaurant_qr_mock_room_wifi_db', JSON.stringify({ ssid: wifiSsid.trim(), pass: wifiPass.trim() }));
        window.dispatchEvent(new Event('storage'));
      } else {
        const wifiDocRef = doc(db, 'tenants', tenantId, 'room_configs', 'wifi');
        await setDoc(wifiDocRef, { ssid: wifiSsid.trim(), pass: wifiPass.trim() });
      }
      toast.success('Smart Cabin Wi-Fi details updated successfully.');
    } catch (err: any) {
      toast.error(`Failed to update Wi-Fi credentials: ${err.message}`);
    } finally {
      setSavingWifi(false);
    }
  };

  const fetchServices = async () => {
    try {
      let list: RoomServiceItem[] = [];
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_services_db');
        if (!stored) {
          // Pre-seed default room services
          const defaultServices: RoomServiceItem[] = [
            {
              id: 'srv_clean',
              tenantId,
              name: 'Daily room cleaning',
              category: 'amenity',
              description: 'Request standard Room Cleaning & vacuuming.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_turndown',
              tenantId,
              name: 'Evening Turndown service',
              category: 'amenity',
              description: 'Request evening turndown service.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_pillow',
              tenantId,
              name: 'Pillow Menu Option',
              category: 'amenity',
              description: 'Choose your preferred pillow type for a comfortable sleep.',
              options: ['Memory Foam', 'Down Feather', 'Orthopedic Support'],
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_minibar',
              tenantId,
              name: 'Mini-bar replenishment',
              category: 'amenity',
              description: 'Request replenishment of standard soft drinks, beer, and snacks in your room.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_laundry',
              tenantId,
              name: 'Express Dry Cleaning',
              category: 'laundry',
              description: 'Garments collected, dry-cleaned, and delivered back within 4 hours.',
              price: 450,
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_massage',
              tenantId,
              name: 'In-Room Swedish Massage',
              category: 'wellness',
              description: 'Professional masseuse session in the comfort of your suite.',
              price: 1800,
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_airport',
              tenantId,
              name: 'Airport Transfer Shuttle',
              category: 'concierge',
              description: 'Private chauffeur luxury vehicle transport to/from International Airport.',
              price: 2500,
              isActive: true,
              createdAt: new Date().toISOString()
            }
          ];
          localStorage.setItem('restaurant_qr_mock_room_services_db', JSON.stringify(defaultServices));
          list = defaultServices;
        } else {
          list = JSON.parse(stored);
        }
      } else {
        const colRef = collection(db, 'tenants', tenantId, 'room_services');
        const snap = await getDocs(colRef);
        list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        if (list.length === 0) {
          // Pre-seed default room services into Firestore
          const defaultServices: RoomServiceItem[] = [
            {
              id: 'srv_clean',
              tenantId,
              name: 'Daily room cleaning',
              category: 'amenity',
              description: 'Request standard Room Cleaning & vacuuming.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_turndown',
              tenantId,
              name: 'Evening Turndown service',
              category: 'amenity',
              description: 'Request evening turndown service.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_pillow',
              tenantId,
              name: 'Pillow Menu Option',
              category: 'amenity',
              description: 'Choose your preferred pillow type for a comfortable sleep.',
              options: ['Memory Foam', 'Down Feather', 'Orthopedic Support'],
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_minibar',
              tenantId,
              name: 'Mini-bar replenishment',
              category: 'amenity',
              description: 'Request replenishment of standard soft drinks, beer, and snacks in your room.',
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_laundry',
              tenantId,
              name: 'Express Dry Cleaning',
              category: 'laundry',
              description: 'Garments collected, dry-cleaned, and delivered back within 4 hours.',
              price: 450,
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_massage',
              tenantId,
              name: 'In-Room Swedish Massage',
              category: 'wellness',
              description: 'Professional masseuse session in the comfort of your suite.',
              price: 1800,
              isActive: true,
              createdAt: new Date().toISOString()
            },
            {
              id: 'srv_airport',
              tenantId,
              name: 'Airport Transfer Shuttle',
              category: 'concierge',
              description: 'Private chauffeur luxury vehicle transport to/from International Airport.',
              price: 2500,
              isActive: true,
              createdAt: new Date().toISOString()
            }
          ];
          for (const s of defaultServices) {
            const docRef = doc(db, 'tenants', tenantId, 'room_services', s.id);
            await setDoc(docRef, { ...s });
          }
          list = defaultServices;
        }
      }
      setServices(list);
    } catch (err) {
      console.error('Failed to load room services:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, [tenantId, isMockMode]);

  const openAddForm = () => {
    setEditingItem(null);
    setName('');
    setCategory('amenity');
    setDescription('');
    setPrice('');
    setOptionsStr('');
    setIsActive(true);
    setShowForm(true);
  };

  const openEditForm = (item: RoomServiceItem) => {
    setEditingItem(item);
    setName(item.name);
    setCategory(item.category);
    setDescription(item.description);
    setPrice(item.price ? String(item.price) : '');
    setOptionsStr(item.options ? item.options.join(', ') : '');
    setIsActive(item.isActive);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      const options = optionsStr.trim()
        ? optionsStr.split(',').map((opt) => opt.trim()).filter((opt) => opt.length > 0)
        : null;

      const priceVal = price.trim() ? Number(price) : null;

      const targetId = editingItem ? editingItem.id : `srv_${Date.now()}`;
      const serviceData: RoomServiceItem = {
        id: targetId,
        tenantId,
        name: name.trim(),
        category,
        description: description.trim(),
        price: priceVal,
        options,
        isActive,
        createdAt: editingItem ? editingItem.createdAt : new Date().toISOString()
      };

      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_services_db');
        const list: RoomServiceItem[] = stored ? JSON.parse(stored) : [];

        if (editingItem) {
          const idx = list.findIndex((s) => s.id === editingItem.id);
          if (idx !== -1) list[idx] = serviceData;
        } else {
          list.push(serviceData);
        }
        localStorage.setItem('restaurant_qr_mock_room_services_db', JSON.stringify(list));
      } else {
        const docRef = doc(db, 'tenants', tenantId, 'room_services', targetId);
        await setDoc(docRef, serviceData);
      }

      toast.success(editingItem ? 'Service item updated successfully.' : 'Service item added successfully.');
      setShowForm(false);
      fetchServices();
    } catch (err: any) {
      toast.error(`Operation failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!window.confirm('Are you sure you want to delete this Room Service item?')) return;

    try {
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_services_db');
        if (stored) {
          const list: RoomServiceItem[] = JSON.parse(stored);
          const filtered = list.filter((s) => s.id !== itemId);
          localStorage.setItem('restaurant_qr_mock_room_services_db', JSON.stringify(filtered));
        }
      } else {
        const docRef = doc(db, 'tenants', tenantId, 'room_services', itemId);
        await deleteDoc(docRef);
      }
      toast.success('Room Service item deleted.');
      fetchServices();
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const toggleServiceActive = async (item: RoomServiceItem) => {
    const updatedStatus = !item.isActive;
    try {
      const updatedItem = { ...item, isActive: updatedStatus };
      if (isMockMode) {
        const stored = localStorage.getItem('restaurant_qr_mock_room_services_db');
        if (stored) {
          const list: RoomServiceItem[] = JSON.parse(stored);
          const idx = list.findIndex((s) => s.id === item.id);
          if (idx !== -1) {
            list[idx] = updatedItem;
            localStorage.setItem('restaurant_qr_mock_room_services_db', JSON.stringify(list));
          }
        }
      } else {
        const docRef = doc(db, 'tenants', tenantId, 'room_services', item.id);
        await setDoc(docRef, updatedItem);
      }
      toast.success(`Service item is now ${updatedStatus ? 'visible' : 'hidden'} to guests.`);
      fetchServices();
      window.dispatchEvent(new Event('storage'));
    } catch (err: any) {
      toast.error(`Failed to update visibility: ${err.message}`);
    }
  };

  const getCategoryLabel = (cat: RoomServiceItem['category']) => {
    switch (cat) {
      case 'amenity': return '🧴 Amenity';
      case 'laundry': return '👕 Laundry';
      case 'wellness': return '🧘 Wellness';
      case 'concierge': return '🚗 Concierge';
      case 'convenience': return '☎️ Convenience';
      default: return '🧹 Cleaning';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12 text-zinc-400 text-xs font-semibold">
        <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading Room Services config...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
        <div>
          <h2 className="text-base font-extrabold text-white">Room Services Manager</h2>
          <p className="text-xs text-zinc-400">Configure customizable in-room requests, pillow menus, premium wellness experiences, and dry cleaning rates.</p>
        </div>
        <button
          onClick={openAddForm}
          className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl shadow-lg shadow-emerald-500/10 transition flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> Add Service
        </button>
      </div>

      {/* Smart Cabin WiFi Credentials Configuration Card */}
      <div className="border border-zinc-850 bg-zinc-900/60 p-5 rounded-2xl space-y-4">
        <div>
          <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider">📡 Smart Cabin Technology & Wi-Fi</h3>
          <p className="text-[10px] text-zinc-500 mt-1">Configure credentials visible under the customer's In-Room Features tab.</p>
        </div>
        <form onSubmit={handleSaveWifi} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Wi-Fi Connection SSID</label>
            <input
              type="text"
              required
              value={wifiSsid}
              onChange={(e) => setWifiSsid(e.target.value)}
              placeholder="e.g. Grand_Palace_Premium"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-2.5 text-xs text-white"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Wi-Fi Password (PASS)</label>
            <input
              type="text"
              required
              value={wifiPass}
              onChange={(e) => setWifiPass(e.target.value)}
              placeholder="e.g. welcome_to_paradise"
              className="w-full bg-zinc-950 border border-zinc-800 focus:border-emerald-500 focus:outline-none rounded-xl p-2.5 text-xs text-white"
            />
          </div>
          <button
            type="submit"
            disabled={savingWifi}
            className="w-full py-2.5 bg-zinc-800 hover:bg-zinc-750 text-white text-xs font-bold rounded-xl transition border border-zinc-700 cursor-pointer text-center flex items-center justify-center gap-1.5"
          >
            {savingWifi ? 'Saving details...' : 'Update Wi-Fi Details'}
          </button>
        </form>
      </div>

      {services.length === 0 ? (
        <div className="border border-dashed border-zinc-800 rounded-3xl p-12 text-center text-zinc-500 text-xs font-medium space-y-2">
          <Sparkles className="h-6 w-6 text-zinc-600 mx-auto" />
          <p>No room service items provisioned. Click "Add Service" to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((item) => (
            <div key={item.id} className={`border rounded-2xl p-5 space-y-4 flex flex-col justify-between transition ${
              item.isActive 
                ? 'border-zinc-850 bg-zinc-900/40 hover:border-zinc-800 hover:shadow-xl hover:shadow-zinc-950/20' 
                : 'border-zinc-900 bg-zinc-950/20 opacity-60'
            }`}>
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                    {getCategoryLabel(item.category)}
                  </span>
                  <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded border ${
                    item.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-850 text-zinc-500 border-zinc-700'
                  }`}>
                    {item.isActive ? 'Active' : 'Disabled'}
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white mt-0.5">{item.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.description}</p>
                </div>

                {/* Display price if any */}
                {item.price !== null && item.price !== undefined && (
                  <div className="text-sm font-extrabold text-zinc-200 flex items-center gap-0.5">
                    Price: <span className="text-emerald-400">₹{item.price}</span>
                  </div>
                )}

                {/* Options tag selector display */}
                {item.options && item.options.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 font-bold block">Dropdown options:</span>
                    <div className="flex flex-wrap gap-1">
                      {item.options.map((opt) => (
                        <span key={opt} className="text-[9px] font-mono px-2 py-0.5 bg-zinc-950 border border-zinc-900 text-zinc-400 rounded-lg">
                          {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-zinc-850 flex justify-end gap-2">
                <button
                  onClick={() => toggleServiceActive(item)}
                  className={`p-2 border border-zinc-900 bg-zinc-950 rounded-xl transition cursor-pointer ${
                    item.isActive 
                      ? 'text-amber-500/75 hover:text-amber-400 hover:bg-zinc-900' 
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
                  }`}
                  title={item.isActive ? "Hide service from guests" : "Show service to guests"}
                >
                  {item.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => openEditForm(item)}
                  className="p-2 border border-zinc-900 bg-zinc-950 text-emerald-500/70 hover:text-emerald-400 rounded-xl hover:bg-zinc-900 transition cursor-pointer"
                  title="Edit service details"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-2 border border-zinc-900 bg-zinc-950 text-red-500/70 hover:text-red-400 rounded-xl hover:bg-zinc-900 transition cursor-pointer"
                  title="Delete service"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form Modal Overlay */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md border border-zinc-800 bg-zinc-950 p-6 shadow-2xl rounded-3xl text-white space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-zinc-850 pb-3">
              <h3 className="text-base font-extrabold text-white">
                {editingItem ? 'Edit Room Service Item' : 'Add Room Service Item'}
              </h3>
              <p className="text-xs text-zinc-400 mt-1">Configure service item parameters visible to guests.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Service Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Memory Foam Pillow, In-suite Massage"
                  className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  >
                    <option value="amenity">🧴 Amenity</option>
                    <option value="laundry">👕 Laundry</option>
                    <option value="wellness">🧘 Wellness</option>
                    <option value="concierge">🚗 Concierge</option>
                    <option value="convenience">☎️ Convenience</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Price (Optional, ₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Description *</label>
                <textarea
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Service description shown to the guest..."
                  rows={3}
                  className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500 block">Dropdown Selections (Optional, Comma Separated)</label>
                <input
                  type="text"
                  value={optionsStr}
                  onChange={(e) => setOptionsStr(e.target.value)}
                  placeholder="e.g. Memory Foam, Down Feather, Orthopedic Support"
                  className="w-full border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs focus:outline-none focus:border-emerald-500 text-zinc-200 rounded-xl"
                />
                <span className="text-[9px] text-zinc-500 block leading-tight">If provided, the customer will see a dropdown selector to choose an option before submitting the request.</span>
              </div>

              <div className="flex items-center gap-2 py-1 select-none cursor-pointer" onClick={() => setIsActive(!isActive)}>
                <div className={`w-4 h-4 border rounded flex items-center justify-center ${
                  isActive ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-zinc-800 bg-zinc-950 text-transparent'
                }`}>
                  <Check className="h-3 w-3 stroke-[3]" />
                </div>
                <span className="text-xs text-zinc-300">Item is active and visible to guests</span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/10 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {submitting ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
