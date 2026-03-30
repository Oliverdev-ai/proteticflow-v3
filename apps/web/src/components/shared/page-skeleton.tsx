export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-neutral-800" />
        <div className="h-4 w-96 rounded-lg bg-neutral-800" />
        <div className="h-72 rounded-2xl bg-neutral-900 border border-neutral-800" />
      </div>
    </div>
  );
}
