import React, { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { FormError } from '../../components/ui/form';
import { Input } from '../../components/ui/input';

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
        <h1 className="text-muted-foreground text-2xl font-semibold">Senha alterada</h1>
        <p className="text-muted-foreground text-sm">Sua senha foi redefinida com sucesso.</p>
        <Link to="/login" className="text-[var(--info)] hover:text-[var(--info)] font-medium text-sm">
          Fazer login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-muted-foreground text-2xl font-semibold text-center">Redefinir senha</h1>
      <p className="text-muted-foreground text-sm text-center mt-2">
        Defina uma nova senha para sua conta.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        {error ? <FormError>{error}</FormError> : null}

        <Input
          label="Nova senha"
          required
          type={showPassword ? 'text' : 'password'}
          placeholder="Nova senha (min 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={resetPassword.isPending}
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showPassword ? 'Ocultar senha' : 'Exibir senha'}
        </button>

        <button
          type="submit"
          disabled={resetPassword.isPending}
          className="w-full h-11 rounded-xl bg-[var(--info-soft)] hover:bg-[var(--info-soft)] text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {resetPassword.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          Alterar senha
        </button>
      </form>
    </div>
  );
}
