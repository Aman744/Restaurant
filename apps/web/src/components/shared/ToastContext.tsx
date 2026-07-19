import React, { createContext, useContext, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType, duration = 4000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
    setTimeout(() => removeToast(id), duration);
  }, [removeToast]);

  const success = useCallback((message: string, duration?: number) => showToast(message, 'success', duration), [showToast]);
  const error = useCallback((message: string, duration?: number) => showToast(message, 'error', duration), [showToast]);
  const info = useCallback((message: string, duration?: number) => showToast(message, 'info', duration), [showToast]);
  const warning = useCallback((message: string, duration?: number) => showToast(message, 'warning', duration), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, info, warning }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 max-w-md w-full px-4 sm:px-0">
        <AnimatePresence>
          {toasts.map((toast) => {
            let bgColor = 'bg-zinc-950/95 border-zinc-800 text-zinc-100';
            let Icon = Info;
            let iconColor = 'text-zinc-400';

            if (toast.type === 'success') {
              bgColor = 'bg-emerald-950/95 border-emerald-800/50 text-emerald-100';
              Icon = CheckCircle;
              iconColor = 'text-emerald-400';
            } else if (toast.type === 'error') {
              bgColor = 'bg-red-950/95 border-red-800/50 text-red-100';
              Icon = AlertCircle;
              iconColor = 'text-red-400';
            } else if (toast.type === 'warning') {
              bgColor = 'bg-amber-950/95 border-amber-800/50 text-amber-100';
              Icon = AlertTriangle;
              iconColor = 'text-amber-400';
            }

            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                className={`flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md shadow-2xl ${bgColor}`}
              >
                <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
                <div className="flex-1 text-xs font-semibold leading-relaxed">{toast.message}</div>
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-0.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
