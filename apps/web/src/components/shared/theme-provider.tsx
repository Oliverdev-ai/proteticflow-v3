import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type ThemeMode = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const STORAGE_KEY = 'proteticflow-theme';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.classList.toggle('dark', resolved === 'dark');
}

function readStoredMode(): ThemeMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  } catch {}
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [theme, setTheme] = useState<ResolvedTheme>('light');

  useEffect(() => {
    const stored = readStoredMode();
    const resolved = resolveTheme(stored);
    setModeState(stored);
    setTheme(resolved);
    applyTheme(resolved);

    if (stored !== 'system') return;

    // Observar mudanças de prefers-color-scheme quando em modo system
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
    const resolved = resolveTheme(next);
    setModeState(next);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    setMode(theme === 'dark' ? 'light' : 'dark');
  }, [setMode, theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme, setMode, toggleTheme }),
    [mode, theme, setMode, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  return ctx;
}

/**
 * Script inline para o <head> — evita flash de tema errado (FOUC).
 * Adicionar em index.html antes de qualquer CSS:
 *   <script>{themeInitScript}</script>
 */
export const themeInitScript = `(function(){
  var k='proteticflow-theme';
  var s=localStorage.getItem(k);
  var d=(!s||s==='system')
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')
    : s;
  document.documentElement.setAttribute('data-theme',d);
  if(d==='dark') document.documentElement.classList.add('dark');
})();`;
