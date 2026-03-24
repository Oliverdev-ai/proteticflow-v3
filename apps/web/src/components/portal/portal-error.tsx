type PortalErrorProps = {
  message?: string;
};

export function PortalError({ message }: PortalErrorProps) {
  return (
    <section className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h2 className="text-lg font-semibold text-red-700">Acesso invalido</h2>
      <p className="text-sm text-red-600 mt-2">{message ?? 'Token invalido, revogado ou expirado.'}</p>
    </section>
  );
}
