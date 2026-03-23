import React, { useState } from 'react';
import { trpc } from '../../../lib/trpc';
import { Link, useSearchParams } from 'react-router-dom';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setSuccess(true),
    onError: (err) => setError(err.message)
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    await resetPassword.mutateAsync({ token, password });
  };

  if (success) {
    return (
      <div className="text-center mt-10">
        <h2 className="text-2xl font-bold">Senha Alterada!</h2>
        <p className="mt-4">Sua senha foi redefinida com sucesso.</p>
        <Link to="/login" className="mt-6 block text-indigo-600">Fazer Login</Link>
      </div>
    );
  }

  return (
    <div className="mt-10">
      <h2 className="text-center text-3xl font-bold">Redefinir Senha</h2>
      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <input
          type="password"
          required
          placeholder="Nova Senha (min 8 caracteres)"
          className="block w-full rounded-md border-0 py-1.5 px-3 text-gray-900 ring-1 ring-inset ring-gray-300"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={resetPassword.isPending} className="w-full justify-center rounded-md bg-indigo-600 py-2 text-white">
          Alterar Senha
        </button>
      </form>
    </div>
  );
}
