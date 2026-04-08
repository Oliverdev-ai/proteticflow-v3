import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { trpc } from '../../lib/trpc';

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
        <h1 className="text-zinc-50 text-2xl font-semibold">Instrucoes enviadas</h1>
        <p className="text-zinc-400 text-sm">Verifique seu e-mail para redefinir sua senha.</p>
        <Link to="/login" className="text-sky-400 hover:text-sky-300 font-medium text-sm">
          Voltar para o login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-zinc-50 text-2xl font-semibold text-center">Recuperar senha</h1>
      <p className="text-zinc-400 text-sm text-center mt-2">
        Digite seu e-mail para receber o link de redefinicao.
      </p>

      <form onSubmit={handleSubmit} className="mt-7 space-y-4">
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="email"
            required
            placeholder="Seu e-mail"
            className="input-field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={forgotPassword.isPending}
          className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-medium disabled:opacity-50 transition-colors"
        >
          {forgotPassword.isPending ? 'Enviando...' : 'Recuperar senha'}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm text-zinc-400 hover:text-zinc-200">
          Voltar para o login
        </Link>
      </div>
    </div>
  );
}
