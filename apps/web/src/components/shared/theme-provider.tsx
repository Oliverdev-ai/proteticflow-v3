import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { trpc } from '../../lib/trpc';

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
  } catch { /* sem localStorage (SSR ou incognito) */ }
  return 'system';
}

function writeStoredMode(mode: ThemeMode) {
  try { localStorage.setItem(STORAGE_KEY, mode); } catch { /* sem-op */ }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode());
  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(readStoredMode()));

  // Mutation tRPC — persiste no DB quando user está autenticado
  const setThemeMutation = trpc.auth.setThemePreference.useMutation();

  // Query do perfil — vem do cache do React Query se já foi carregado
  const { data: profile } = trpc.auth.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60_000,
    // Não bloquear a UI — apenas sincronizar quando chegar
  });

  // Prioridade 1: DB (quando o perfil carrega pela primeira vez)
  const dbSyncedRef = useRef(false);
  useEffect(() => {
    if (!profile || dbSyncedRef.current) return;
    const dbTheme = (profile as { themePreference?: string }).themePreference;
    if (dbTheme === 'system' || dbTheme === 'light' || dbTheme === 'dark') {
      dbSyncedRef.current = true;
      const dbMode = dbTheme as ThemeMode;
      writeStoredMode(dbMode);
      setModeState(dbMode);
      const resolved = resolveTheme(dbMode);
      setTheme(resolved);
      applyTheme(resolved);
    }
  }, [profile]);

  // Prioridade 2 + 3: localStorage + system — aplicado no mount
  useEffect(() => {
    const stored = readStoredMode();
    const resolved = resolveTheme(stored);
    setModeState(stored);
    setTheme(resolved);
    applyTheme(resolved);

    if (stored !== 'system') return;

    // Observar mudanças de prefers-color-scheme em modo system
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (readStoredMode() !== 'system') return; // user mudou manualmente
      const next: ResolvedTheme = e.matches ? 'dark' : 'light';
      setTheme(next);
      applyTheme(next);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      writeStoredMode(next);
      setModeState(next);
      const resolved = resolveTheme(next);
      setTheme(resolved);
      applyTheme(resolved);
      // Persiste no DB (fire-and-forget — não bloqueia a UI)
      setThemeMutation.mutate({ theme: next });
    },
    [setThemeMutation],
  );

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
 * Já inserido em index.html diretamente (sem depender do React).
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
