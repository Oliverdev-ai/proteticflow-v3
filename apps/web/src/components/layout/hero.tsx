import { type ReactNode } from 'react';
import { cn } from '../../lib/utils';

/* ─── Saudação contextual por hora ────────────────────────── */
function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return `Bom dia, ${firstName}.`;
  if (hour >= 12 && hour < 18) return `Boa tarde, ${firstName}.`;
  return `Boa noite, ${firstName}.`;
}

function getFirstName(fullName?: string | null): string {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/* ─── Props ────────────────────────────────────────────────── */
export type HeroProps = {
  /** Nome completo do usuário (extrai o primeiro automaticamente) */
  name?: string | null;
  /** Subtítulo dinâmico — insight do dia, entregues, atrasos, etc. */
  subtitle?: ReactNode;
  /** URL ou import de imagem para o slot de background (direita) */
  imageSrc?: string;
  /** Alt text da imagem */
  imageAlt?: string;
  /** Label do CTA primário */
  ctaLabel?: string;
  /** Callback do CTA */
  onCtaClick?: () => void;
  /** Classes extras para o container */
  className?: string;
};

/* ─── Hero ─────────────────────────────────────────────────── */
export function Hero({
  name,
  subtitle,
  imageSrc,
  imageAlt = '',
  ctaLabel,
  onCtaClick,
  className,
}: HeroProps) {
  const firstName = getFirstName(name);
  const greeting = getGreeting(firstName || 'bem-vindo');

  return (
    <div
      className={cn(
        'relative rounded-2xl overflow-hidden mb-6',
        'bg-gradient-to-br from-[var(--primary)]/10 via-[var(--bg)] to-[var(--accent)]/8',
        'border border-[var(--border)]',
        className,
      )}
      style={{ minHeight: 140 }}
    >
      {/* Conteúdo textual */}
      <div className="relative z-10 p-6 md:p-8 flex flex-col justify-center gap-2" style={{ maxWidth: imageSrc ? '65%' : '100%' }}>
        <p
          className="text-2xl md:text-3xl font-semibold text-foreground leading-tight"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {greeting}
        </p>

        {subtitle && (
          <p className="text-[13px] md:text-sm text-muted-foreground leading-relaxed">
            {subtitle}
          </p>
        )}

        {ctaLabel && onCtaClick && (
          <button
            onClick={onCtaClick}
            className={cn(
              'mt-3 self-start px-4 py-2 rounded-lg text-[13px] font-semibold',
              'bg-[var(--primary)] text-white',
              'hover:opacity-90 active:scale-[0.97] transition-all duration-100',
              'outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/50',
            )}
          >
            {ctaLabel}
          </button>
        )}
      </div>

      {/* Slot de imagem (direita, decorativa) */}
      {imageSrc && (
        <div
          className="absolute right-0 top-0 bottom-0 pointer-events-none"
          style={{ width: '38%' }}
          aria-hidden="true"
        >
          <img
            src={imageSrc}
            alt={imageAlt}
            className="h-full w-full object-cover object-left"
            style={{
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,1) 60%)',
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,1) 60%)',
            }}
          />
        </div>
      )}

      {/* Gradiente sutil no fundo */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            'radial-gradient(ellipse at 80% 50%, rgba(233,115,22,0.06) 0%, transparent 60%)',
        }}
      />
    </div>
  );
}

/* ─── HeroSkeleton ─────────────────────────────────────────── */
export function HeroSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-muted/30 animate-pulse mb-6',
        className,
      )}
      style={{ minHeight: 140 }}
      aria-hidden="true"
    />
  );
}
