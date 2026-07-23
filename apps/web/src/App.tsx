import { useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { db } from './lib/firebase.js';
import { HashRouter as Router } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/context/AuthContext';
import { UserProvider } from './features/auth/context/UserContext';
import { TenantProvider } from './features/auth/context/TenantContext';
import { PermissionProvider } from './features/auth/context/PermissionContext';
import { ThemeContextProvider } from './features/auth/context/ThemeContext';
import { AppRouter } from './app/router';
import { ToastProvider } from './components/shared/ToastContext';
import { ConfirmProvider } from './components/shared/ConfirmContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

import { onSnapshot } from 'firebase/firestore';

function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    let active = true;
    
    const updateThemeStyles = (themeMode: string, primaryCol: string, fontFam: string) => {
      const root = document.documentElement;
      
      // Override with user's local manual theme selection if present, else follow system theme
      const savedMode = localStorage.getItem('color-mode');
      const themeToApply = savedMode || themeMode;
      
      if (themeToApply === 'light') {
        root.classList.add('light');
        root.classList.remove('dark');
      } else {
        root.classList.add('dark');
        root.classList.remove('light');
      }

      root.style.setProperty('--primary-color', primaryCol);
      root.style.setProperty('--font-family', fontFam);
    };

    let unsubscribe: () => void = () => {};
    const isMockMode = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'your_api_key_here';

    if (isMockMode) {
      const syncTheme = () => {
        let defaultTheme = 'dark';
        let primaryColor = '#10b981';
        let fontFamily = 'Inter';
        const cachedWhiteLabel = localStorage.getItem('restaurant_qr_system_whitelabel');
        if (cachedWhiteLabel) {
          try {
            const parsed = JSON.parse(cachedWhiteLabel);
            defaultTheme = parsed.defaultTheme || defaultTheme;
            primaryColor = parsed.primaryColor || primaryColor;
            fontFamily = parsed.fontFamily || fontFamily;
          } catch (e) {}
        }
        if (active) {
          updateThemeStyles(defaultTheme, primaryColor, fontFamily);
        }
      };

      syncTheme();
      window.addEventListener('storage', syncTheme);
      const interval = setInterval(syncTheme, 1500);

      unsubscribe = () => {
        window.removeEventListener('storage', syncTheme);
        clearInterval(interval);
      };
    } else {
      const docRef = doc(db, 'system_settings', 'general');
      unsubscribe = onSnapshot(docRef, (snap: any) => {
        if (snap.exists() && active) {
          const data = snap.data();
          let defaultTheme = 'dark';
          let primaryColor = '#10b981';
          let fontFamily = 'Inter';
          if (data.whiteLabelConfig) {
            defaultTheme = data.whiteLabelConfig.defaultTheme || defaultTheme;
            primaryColor = data.whiteLabelConfig.primaryColor || primaryColor;
            fontFamily = data.whiteLabelConfig.fontFamily || fontFamily;
          }
          updateThemeStyles(defaultTheme, primaryColor, fontFamily);
        }
      }, (err: any) => {
        console.warn('Theme listener failed, falling back:', err);
      });
    }

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      active = false;
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeContextProvider>
        <Router>
          <AuthProvider>
            <UserProvider>
              <TenantProvider>
                <PermissionProvider>
                  <ToastProvider>
                    <ConfirmProvider>
                      <div className="relative min-h-screen">
                        {!isOnline && (
                          <div className="fixed top-0 inset-x-0 z-[9999] bg-red-500/90 text-white font-extrabold text-xs text-center py-2.5 shadow-lg backdrop-blur-sm flex items-center justify-center gap-2 select-none animate-slideDown border-b border-red-400">
                            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
                            NO INTERNET CONNECTION — OPERATING IN OFFLINE RECOVERY MODE
                          </div>
                        )}
                        <AppRouter />
                      </div>
                    </ConfirmProvider>
                  </ToastProvider>
                </PermissionProvider>
              </TenantProvider>
            </UserProvider>
          </AuthProvider>
        </Router>
      </ThemeContextProvider>
    </QueryClientProvider>
  );
}

export default App;
