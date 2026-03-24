type PortalHeaderProps = {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantPrimaryColor: string | null;
  clientName: string;
};

export function PortalHeader({ tenantName, tenantLogoUrl, tenantPrimaryColor, clientName }: PortalHeaderProps) {
  return (
    <header className="rounded-2xl border border-neutral-200 bg-white p-5">
      <div className="flex items-center gap-3">
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} className="w-12 h-12 rounded-lg object-cover border border-neutral-200" />
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: tenantPrimaryColor ?? '#0f766e' }}
          >
            {tenantName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Portal do Cliente</p>
          <h1 className="text-xl font-semibold text-neutral-900">{tenantName}</h1>
          <p className="text-sm text-neutral-600">Cliente: {clientName}</p>
        </div>
      </div>
    </header>
  );
}
