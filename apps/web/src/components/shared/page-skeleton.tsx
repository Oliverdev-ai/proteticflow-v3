export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-muted" />
        <div className="h-4 w-96 rounded-lg bg-muted" />
        <div className="h-72 rounded-lg bg-muted border border-border" />
      </div>
    </div>
  );
}
