import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';

type ColorMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ColorMode;
  toggleColorMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = localStorage.getItem('color-mode');
    if (saved === 'light' || saved === 'dark') return saved;
    
    // Check cached system settings theme preferences
    const cachedWhiteLabel = localStorage.getItem('restaurant_qr_system_whitelabel');
    if (cachedWhiteLabel) {
      try {
        const parsed = JSON.parse(cachedWhiteLabel);
        if (parsed.defaultTheme === 'light' || parsed.defaultTheme === 'dark') {
          return parsed.defaultTheme;
        }
      } catch {}
    }
    return 'dark'; // Default to dark mode
  });

  useEffect(() => {
    const root = document.documentElement;
    if (mode === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
    } else {
      root.classList.add('dark');
      root.classList.remove('light');
    }
    localStorage.setItem('color-mode', mode);
  }, [mode]);

  const toggleColorMode = () => {
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const muiTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: '#10b981', // Emerald 500
          },
          background: {
            default: mode === 'light' ? '#fafafa' : '#09090b', // zinc-50 vs zinc-950
            paper: mode === 'light' ? '#ffffff' : '#18181b', // white vs zinc-900
          },
          text: {
            primary: mode === 'light' ? '#09090b' : '#fafafa',
            secondary: mode === 'light' ? '#71717a' : '#a1a1aa',
          },
        },
        typography: {
          fontFamily: 'Plus Jakarta Sans, Inter, sans-serif',
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: '12px',
                textTransform: 'none',
                fontWeight: 600,
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ThemeContext.Provider value={{ mode, toggleColorMode }}>
      <ThemeProvider theme={muiTheme}>
        {children}
      </ThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useColorMode = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useColorMode must be used within a ThemeContextProvider');
  return context;
};
