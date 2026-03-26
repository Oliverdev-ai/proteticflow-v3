import React, { useState } from 'react';
import { trpc } from '../../lib/trpc';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/use-auth';
import { registerSchema } from '@proteticflow/shared';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth(); // or we can use the mutation directly from auth
  
  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      // Auto-login after register
      await login({ email, password });
      navigate('/');
    },
    onError: (err) => {
      setError(err.message || 'Erro ao registrar usuário.');
      setLoading(false);
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      registerSchema.parse({ name, email, password });
      setLoading(true);
      setError('');
      await registerMutation.mutateAsync({ name, email, password });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) {
        setError('Preencha os campos corretamente.');
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro inesperado.');
      }
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
        Crie sua conta
      </h2>
      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && <div className="text-red-500 text-sm text-center">{error}</div>}
        <div className="-space-y-px rounded-md shadow-sm">
          <div>
            <input
              type="text"
              required
              className="relative block w-full rounded-t-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              placeholder="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <input
              type="email"
              required
              className="relative block w-full border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              placeholder="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div>
            <input
              type="password"
              required
              className="relative block w-full rounded-b-md border-0 py-1.5 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 px-3"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Já tem conta? Faça login
            </Link>
          </div>
        </div>
        <div>
          <button
            type="submit"
            disabled={loading}
            className="group relative flex w-full justify-center rounded-md bg-indigo-600 py-2 px-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          >
            {loading ? 'Registrando...' : 'Registrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
