import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { loginSchema } from '@proteticflow/shared/validation/auth.schema';
import { useAuth } from '../../hooks/use-auth';

function getFriendlyLoginError(err: unknown): string {
  if (err instanceof z.ZodError) return 'Preencha os campos corretamente.';

  if (err instanceof Error) {
    const message = err.message.toLowerCase();
    if (
      message.includes("failed to execute 'json'") ||
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('connection refused') ||
      message.includes('err_connection_refused')
    ) {
      return 'Não foi possível conectar ao servidor. Verifique se o backend está ativo e tente novamente.';
    }
    if (message.includes('credenciais')) return 'E-mail ou senha inválidos.';
    return 'Não foi possível concluir o login. Tente novamente.';
  }

  return 'Erro inesperado.';
}

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      loginSchema.parse({ email, password });
      setLoading(true);
      setError('');
      await login({ email, password });
    } catch (err: unknown) {
      setError(getFriendlyLoginError(err));
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-muted-foreground text-2xl font-semibold text-center">Entrar no ProteticFlow</h1>
      <p className="text-muted-foreground text-sm text-center mt-2">Acesse sua operação com segurança.</p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-soft)] px-3 py-2 text-sm text-[var(--destructive)]">
            {error}
          </div>
        )}

        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="email"
            required
            className="input-field"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            className="input-field !pr-11"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--fg-subtle)] transition-colors hover:text-[var(--fg)] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
            aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="flex items-center justify-between text-sm pt-1">
          <Link to="/forgot-password" className="text-muted-foreground hover:text-muted-foreground">
            Esqueci a senha
          </Link>
          <Link
            to="/register"
            className="text-[var(--primary)] hover:text-[var(--primary-hover)] font-semibold"
          >
            Criar conta
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-[var(--fg-on-primary)] font-semibold disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
