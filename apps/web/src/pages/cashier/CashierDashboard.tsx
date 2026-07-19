import React, { useState } from 'react';
import { DashboardLayout } from '../../components/shared/DashboardLayout';
import { CreditCard, Receipt, CheckCircle } from 'lucide-react';

interface BillTicket {
  id: string;
  tableNumber: string;
  subtotal: number;
  tax: number;
  serviceCharge: number;
  total: number;
  itemsCount: number;
}

export const CashierDashboard: React.FC = () => {
  const sidebarItems = [
    { name: 'Pending Bills', path: '/cashier', icon: CreditCard },
  ];

  const [pendingBills, setPendingBills] = useState<BillTicket[]>([
    { id: 'ord_201', tableNumber: 'Table 2', subtotal: 45.0, tax: 3.6, serviceCharge: 4.5, total: 53.1, itemsCount: 4 },
    { id: 'ord_202', tableNumber: 'Table 6', subtotal: 28.5, tax: 2.28, serviceCharge: 2.85, total: 33.63, itemsCount: 2 },
  ]);

  const [selectedBill, setSelectedBill] = useState<BillTicket | null>(null);
  const [splitCount, setSplitCount] = useState(1);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'card' | 'upi'>('cash');

  const handleSettle = (billId: string) => {
    setPendingBills((prev) => prev.filter((b) => b.id !== billId));
    setSelectedBill(null);
    setSplitCount(1);
  };

  return (
    <DashboardLayout title="Cashier Billing & POS" sidebarItems={sidebarItems}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Pending Bills */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Pending Table Settlements</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingBills.map((b) => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBill(b)}
                  className={`border p-5 rounded-2xl cursor-pointer transition-all flex flex-col justify-between h-40 ${
                    selectedBill?.id === b.id
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/10'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-base text-white">{b.tableNumber}</h4>
                      <p className="text-[10px] text-zinc-500">Bill ID: {b.id}</p>
                    </div>
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {b.itemsCount} items
                    </span>
                  </div>

                  <div className="flex justify-between items-end mt-4">
                    <span className="text-xs text-zinc-400 font-medium">Grand Total:</span>
                    <span className="text-xl font-bold text-white">${b.total.toFixed(2)}</span>
                  </div>
                </div>
              ))}

              {pendingBills.length === 0 && (
                <div className="col-span-full border border-zinc-900 bg-zinc-950 py-16 text-center text-zinc-500 rounded-3xl">
                  <CheckCircle className="h-10 w-10 mx-auto text-emerald-500/10 mb-3" />
                  <p className="text-sm font-medium">All bills settled!</p>
                </div>
              )}
            </div>
          </div>

          {/* Settle Panel */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Settlement Console</h3>

            {selectedBill ? (
              <div className="border border-zinc-800 bg-zinc-900/40 p-5 rounded-2xl space-y-5">
                <div>
                  <h4 className="font-bold text-white">{selectedBill.tableNumber}</h4>
                  <p className="text-[10px] text-zinc-500">Settling invoice #{selectedBill.id}</p>
                </div>

                <div className="space-y-2 border-y border-zinc-800 py-4 text-sm">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span>${selectedBill.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Tax (GST)</span>
                    <span>${selectedBill.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Service Charge</span>
                    <span>${selectedBill.serviceCharge.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-white font-bold text-base mt-2">
                    <span>Total Amount</span>
                    <span>${selectedBill.total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Splitting Option */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Split Bill</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSplitCount(Math.max(1, splitCount - 1))}
                      className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300"
                    >
                      -
                    </button>
                    <span className="flex-1 text-center font-bold text-white text-sm">{splitCount} Guests</span>
                    <button
                      onClick={() => setSplitCount(splitCount + 1)}
                      className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300"
                    >
                      +
                    </button>
                  </div>

                  {splitCount > 1 && (
                    <div className="p-3 border border-emerald-500/10 bg-emerald-500/5 rounded-xl flex justify-between text-xs text-emerald-400 font-semibold mt-2">
                      <span>Each Pays:</span>
                      <span>${(selectedBill.total / splitCount).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Payment Mode Selector */}
                <div className="space-y-2">
                  <label className="text-xs text-zinc-400 font-semibold uppercase tracking-wider">Payment Mode</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['cash', 'card', 'upi'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setPaymentMode(mode)}
                        className={`py-2 px-3 text-[10px] font-bold uppercase rounded-lg border transition ${
                          paymentMode === mode
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25'
                            : 'bg-zinc-800/40 text-zinc-400 border-zinc-850 hover:bg-zinc-800'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSettle(selectedBill.id)}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-xl shadow-lg shadow-emerald-500/10 text-xs uppercase tracking-wider"
                >
                  Confirm Settle & Print Receipt
                </button>
              </div>
            ) : (
              <div className="border border-dashed border-zinc-800 py-16 text-center text-zinc-600 rounded-2xl">
                <Receipt className="h-8 w-8 mx-auto text-zinc-700 mb-3" />
                <p className="text-xs font-medium">Select a pending bill to view settlement console</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};
