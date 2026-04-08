import React from 'react';
import { Outlet } from 'react-router-dom';
import { Layers3 } from 'lucide-react';
import { ParticleField } from '../../components/auth/particle-field';

export default function AuthLayout() {
  return (
    <div className="auth-bg min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Particle field — fundo orgânico interativo */}
      <ParticleField />

      {/* Conteúdo (acima do canvas) */}
      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Layers3 size={22} className="text-white" />
          </div>
          <span className="text-zinc-100 text-xl font-semibold tracking-tight">ProteticFlow</span>
        </div>

        <div className="w-full max-w-md bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>

        <p className="mt-8 text-zinc-600 text-xs">
          © 2026 ProteticFlow. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
