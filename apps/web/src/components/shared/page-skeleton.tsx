export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-zinc-800" />
        <div className="h-4 w-96 rounded-lg bg-zinc-800" />
        <div className="h-72 rounded-2xl bg-zinc-900 border border-zinc-800" />
      </div>
    </div>
  );
}
