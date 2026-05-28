import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { Input } from '../../components/ui/input';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);

  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setSuccess(true),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgotPassword.mutateAsync({ email });
  };

  if (success) {
    return (
      <div className="text-center space-y-3">
        <h1 className="text-muted-foreground text-2xl font-semibold">Instrucoes enviadas</h1>
        <p className="text-muted-foreground text-sm">Verifique seu e-mail para redefinir sua senha.</p>
        <Link to="/login" className="text-[var(--info)] hover:text-[var(--info)] font-medium text-sm">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-muted-foreground text-2xl font-semibold text-center">Recuperar senha</h1>
      <p className="text-muted-foreground text-sm text-center mt-2">
        Digite seu e-mail para receber o link de redefinicao.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <Input
          label="Seu e-mail"
          required
          type="email"
          placeholder="Seu e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={forgotPassword.isPending}
        />
        <button
          type="submit"
          disabled={forgotPassword.isPending}
          className="w-full h-11 rounded-xl bg-[var(--info-soft)] hover:bg-[var(--info-soft)] text-white font-medium disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {forgotPassword.isPending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
          Recuperar senha
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-muted-foreground hover:text-muted-foreground">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
