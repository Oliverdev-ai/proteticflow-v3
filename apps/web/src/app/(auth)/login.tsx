import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { loginSchema } from '@proteticflow/shared';
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
      return 'Nao foi possivel conectar ao servidor. Verifique se o backend esta ativo e tente novamente.';
    }
    if (message.includes('credenciais')) return 'Email ou senha invalidos.';
    return 'Nao foi possivel concluir o login. Tente novamente.';
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
      <h1 className="text-zinc-50 text-2xl font-semibold text-center">Entrar no ProteticFlow</h1>
      <p className="text-zinc-400 text-sm text-center mt-2">Acesse sua operação com segurança.</p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
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
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            className="input-field"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-200"
            aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="flex items-center justify-between text-sm pt-1">
          <Link to="/forgot-password" className="text-zinc-400 hover:text-zinc-200">
            Esqueci a senha
          </Link>
          <Link to="/register" className="text-sky-400 hover:text-sky-300 font-medium">
            Criar conta
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}

