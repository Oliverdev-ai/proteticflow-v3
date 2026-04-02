import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { trpc } from '../../lib/trpc';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    await resetPassword.mutateAsync({ token, password });
  };

  if (success) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-zinc-50 text-2xl font-semibold">Senha alterada</h1>
        <p className="text-zinc-400 text-sm">Sua senha foi redefinida com sucesso.</p>
        <Link to="/login" className="text-sky-400 hover:text-sky-300 font-medium text-sm">
          Fazer login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-zinc-50 text-2xl font-semibold text-center">Redefinir senha</h1>
      <p className="text-zinc-400 text-sm text-center mt-2">Defina uma nova senha para sua conta.</p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="relative">
          <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            placeholder="Nova senha (min 8 caracteres)"
            className="input-field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <button
          type="submit"
          disabled={resetPassword.isPending}
          className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {resetPassword.isPending ? 'Alterando...' : 'Alterar senha'}
        </button>
      </form>
    </div>
  );
}

