type TooltipPayload = {
  name?: string | number;
  value?: string | number;
  color?: string;
};

export type ChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayload[];
  valueFormatter?: ((value: string | number) => string) | undefined;
};

export function ChartTooltip({
  active,
  label,
  payload,
  valueFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground shadow-xl">
      {label !== undefined && (
        <p className="mb-1 font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.name ?? 'item'}-${index}`} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground">{item.name}</span>
            <span className="font-tabular font-semibold text-foreground">
              {item.value !== undefined && valueFormatter ? valueFormatter(item.value) : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
