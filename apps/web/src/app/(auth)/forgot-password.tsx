import React, { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Link } from 'react-router-dom';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  
  const forgotPassword = trpc.auth.forgotPassword.useMutation({
    onSuccess: () => setSuccess(true)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await forgotPassword.mutateAsync({ email });
  };

  if (success) {
    return (
      <div className="text-center mt-10">
        <h2 className="text-2xl font-bold">Instruções Enviadas!</h2>
        <p className="mt-4">Verifique seu e-mail para redefinir a senha.</p>
        <Link to="/login" className="mt-6 block text-indigo-600">Voltar para o Login</Link>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="text-center text-3xl font-bold">Esqueci a Senha</h2>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <input
          type="email"
          required
          placeholder="Seu e-mail"
          className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" disabled={forgotPassword.isPending} className="w-full justify-center rounded-md bg-indigo-600 py-2 text-white">
          Recuperar Senha
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link to="/login" className="text-sm font-medium text-indigo-600">Voltar para o Login</Link>
      </div>
    </div>
  );
}
