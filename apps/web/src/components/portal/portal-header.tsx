type PortalHeaderProps = {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantPrimaryColor: string | null;
  clientName: string;
};

export function PortalHeader({ tenantName, tenantLogoUrl, tenantPrimaryColor, clientName }: PortalHeaderProps) {
  return (
    <header className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center gap-3">
        {tenantLogoUrl ? (
          <img src={tenantLogoUrl} alt={tenantName} className="w-12 h-12 rounded-lg object-cover border border-border" />
        ) : (
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: tenantPrimaryColor ?? '#0f766e' }} // design-tokens-ok — cor de branding do tenant (valor do banco)
          >
            {tenantName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-normal">Portal do Cliente</p>
          <h1 className="text-xl font-semibold text-muted-foreground">{tenantName}</h1>
          <p className="text-sm text-muted-foreground">Cliente: {clientName}</p>
        </div>
      </div>
    </header>
  );
}
