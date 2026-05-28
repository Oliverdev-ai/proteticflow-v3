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
          <div className="w-12 h-12 rounded-xl bg-[var(--info-soft)] flex items-center justify-center shadow-lg">
            <Layers3 size={22} className="text-white" />
          </div>
          <span className="text-muted-foreground text-xl font-semibold tracking-tight">ProteticFlow</span>
        </div>

        <div className="w-full max-w-md bg-muted backdrop-blur-sm border border-border rounded-lg shadow-md p-8">
          <Outlet />
        </div>

        <p className="mt-8 text-muted-foreground text-xs">
          © 2026 ProteticFlow. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
