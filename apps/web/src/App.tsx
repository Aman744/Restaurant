import { useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './lib/firebase.js';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/context/AuthContext';
import { UserProvider } from './features/auth/context/UserContext';
import { TenantProvider } from './features/auth/context/TenantContext';
import { PermissionProvider } from './features/auth/context/PermissionContext';
import { AppRouter } from './app/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function App() {
  useEffect(() => {
    let active = true;
    
    const applySystemSettings = async () => {
      let defaultTheme = 'dark';
      let primaryColor = '#10b981';
      let fontFamily = 'Inter';

      const isMockMode = !import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY === 'your_api_key_here';

      if (isMockMode) {
        const cachedWhiteLabel = localStorage.getItem('restaurant_qr_system_whitelabel');
        if (cachedWhiteLabel) {
          try {
            const parsed = JSON.parse(cachedWhiteLabel);
            defaultTheme = parsed.defaultTheme || defaultTheme;
            primaryColor = parsed.primaryColor || primaryColor;
            fontFamily = parsed.fontFamily || fontFamily;
          } catch (e) {}
        }
      } else {
        try {
          const docRef = doc(db, 'system_settings', 'general');
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            if (data.whiteLabelConfig) {
              defaultTheme = data.whiteLabelConfig.defaultTheme || defaultTheme;
              primaryColor = data.whiteLabelConfig.primaryColor || primaryColor;
              fontFamily = data.whiteLabelConfig.fontFamily || fontFamily;
            }
          }
        } catch (e) {
          console.error('Failed to load system theme settings:', e);
        }
      }

      if (active) {
        const root = document.documentElement;
        if (defaultTheme === 'light') {
          root.classList.add('light');
          root.classList.remove('dark');
        } else {
          root.classList.add('dark');
          root.classList.remove('light');
        }

        root.style.setProperty('--primary-color', primaryColor);
        root.style.setProperty('--font-family', fontFamily);
      }
    };

    applySystemSettings();
    return () => { active = false; };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <UserProvider>
            <TenantProvider>
              <PermissionProvider>
                <AppRouter />
              </PermissionProvider>
            </TenantProvider>
          </UserProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
