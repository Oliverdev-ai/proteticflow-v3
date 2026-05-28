type PortalErrorProps = {
  message?: string;
};

export function PortalError({ message }: PortalErrorProps) {
  return (
    <section
      data-testid="portal-error"
      className="rounded-lg border border-[var(--destructive)] bg-[var(--destructive-soft)] p-8 text-center"
    >
      <h2 className="text-lg font-semibold text-[var(--destructive)]">Acesso invalido</h2>
      <p className="text-sm text-[var(--destructive)] mt-2">{message ?? 'Token invalido, revogado ou expirado.'}</p>
    </section>
  );
}
