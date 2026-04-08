import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, UserRound } from 'lucide-react';
import { registerSchema } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/use-auth';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await login({ email, password });
      navigate('/');
    },
    onError: (err) => {
      setError(err.message || 'Erro ao registrar usuário.');
      setLoading(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      registerSchema.parse({ name, email, password });
      setLoading(true);
      setError('');
      await registerMutation.mutateAsync({ name, email, password });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) setError('Preencha os campos corretamente.');
      else if (err instanceof Error) setError(err.message);
      else setError('Erro inesperado.');
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-zinc-50 text-2xl font-semibold text-center">Criar conta</h1>
      <p className="text-zinc-400 text-sm text-center mt-2">
        Comece seu laboratório digital em minutos.
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="relative">
          <UserRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            required
            className="input-field"
            placeholder="Nome completo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />
        </div>

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

        <div className="text-sm pt-1">
          <Link to="/login" className="text-zinc-400 hover:text-zinc-200">
            Já tem conta? Fazer login
          </Link>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {loading ? 'Criando conta...' : 'Criar conta'}
        </button>
      </form>
    </div>
  );
}
