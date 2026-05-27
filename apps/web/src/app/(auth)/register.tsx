import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { registerSchema } from '@proteticflow/shared';
import { trpc } from '../../lib/trpc';
import { useAuth } from '../../hooks/use-auth';
import { FormError } from '../../components/ui/form';
import { Input } from '../../components/ui/input';

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
  const isSubmitting = loading || registerMutation.isPending;

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
      <h1 className="text-muted-foreground text-2xl font-semibold text-center">Criar conta</h1>
      <p className="text-muted-foreground text-sm text-center mt-2">
        Comece seu laboratório digital em minutos.
      </p>

      <form className="mt-7 space-y-4" onSubmit={handleSubmit}>
        {error ? <FormError>{error}</FormError> : null}

        <Input
          label="Nome completo"
          required
          type="text"
          placeholder="Nome completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="E-mail"
          required
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="Senha"
          required
          type={showPassword ? 'text' : 'password'}
          placeholder="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isSubmitting}
        />

        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {showPassword ? 'Ocultar senha' : 'Exibir senha'}
        </button>

        <div className="text-sm pt-1">
          <Link to="/login" className="text-muted-foreground hover:text-muted-foreground">
            Já tem conta? Fazer login
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-11 rounded-xl bg-[var(--info-soft)] hover:bg-[var(--info-soft)] text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {isSubmitting ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          Criar conta
        </button>
      </form>
    </div>
  );
}
