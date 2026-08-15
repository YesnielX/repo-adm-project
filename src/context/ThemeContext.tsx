import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export type ThemeName = 'arcade' | 'matrix';

interface ThemeContextType {
  theme: ThemeName;
  toggleTheme: () => void;
  setTheme: (theme: ThemeName) => void;
}

const THEME_STORAGE_KEY = 'codeimpostor-theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'matrix' ? 'matrix' : 'arcade';
  } catch {
    return 'arcade';
  }
}

/**
 * Cambia el tema con View Transitions API + clip-path: el navegador captura
 * el snapshot de la app, el estado cambia, y el snapshot nuevo se revela con
 * un barrido de clip-path (inset). Si el navegador no soporta
 * startViewTransition o el usuario prefiere movimiento reducido, el cambio
 * es instantáneo.
 */
function applyThemeWithTransition(next: ThemeName, apply: (theme: ThemeName) => void): void {
  const doc = document as Document & {
    startViewTransition?: (update: () => void) => { ready: Promise<void> };
  };

  if (!doc.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply(next);
    return;
  }

  const transition = doc.startViewTransition(() => apply(next));

  // Una vez que la transición está capturada, anima el pseudo-elemento del
  // snapshot nuevo: se revela desde el borde superior con clip-path.
  transition.ready.then(() => {
    document.documentElement.animate(
      { clipPath: ['inset(0 0 100% 0)', 'inset(0)'] },
      {
        pseudoElement: '::view-transition-new(root)',
        duration: 850,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    );
  });
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(getInitialTheme);

  // Sincroniza la clase de scope en <html> y persiste el tema elegido.
  // Solo toca el DOM y localStorage: no dispara setState dentro del efecto.
  useEffect(() => {
    document.documentElement.classList.toggle('theme-matrix', theme === 'matrix');
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (err) {
      console.error(err);
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeName = theme === 'arcade' ? 'matrix' : 'arcade';
    applyThemeWithTransition(next, setThemeState);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }
  return context;
};
