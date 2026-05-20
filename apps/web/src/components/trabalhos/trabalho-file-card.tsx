import { AlertCircle, Download, FileText, ImageIcon, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { cn } from '../../lib/utils';

type TrabalhoFile = {
  id: number;
  url: string;
  description: string | null;
  createdAt: string | Date;
};

export type TrabalhoFileCardProps = {
  photo: TrabalhoFile;
  index: number;
};

function getFileLabel(photo: TrabalhoFile): string {
  const label = photo.description?.trim();
  if (label) return label;
  return photo.url.split('/').at(-1) ?? 'Arquivo tecnico';
}

function isImageFile(value: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(value.trim());
}

export function TrabalhoFileCard({ photo, index }: TrabalhoFileCardProps) {
  const label = getFileLabel(photo);
  const isImage = isImageFile(photo.url) || isImageFile(label);
  const downloadQuery = trpc.job.getPresignedDownloadUrl.useQuery(
    { photoId: photo.id },
    { staleTime: 45 * 60 * 1000, retry: 1 },
  );
  const downloadUrl = downloadQuery.data?.downloadUrl;

  return (
    <article
      className="group overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-xl"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex aspect-[4/3] items-center justify-center bg-muted/40">
        {downloadQuery.isLoading ? (
          <Loader2 className="animate-spin text-primary" size={22} />
        ) : downloadQuery.error ? (
          <div className="flex flex-col items-center gap-2 text-destructive">
            <AlertCircle size={24} />
            <span className="text-xs font-semibold">URL indisponivel</span>
          </div>
        ) : isImage && downloadUrl ? (
          <img
            src={downloadUrl}
            alt={label}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <FileText size={34} />
            <span className="text-xs font-semibold uppercase tracking-wide">Arquivo tecnico</span>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-muted text-primary">
            {isImage ? <ImageIcon size={17} /> : <FileText size={17} />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{label}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {new Date(photo.createdAt).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <a
          href={downloadUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!downloadUrl}
          className={cn(
            'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-muted text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary',
            !downloadUrl && 'pointer-events-none opacity-50',
          )}
        >
          <Download size={15} />
          Abrir arquivo
        </a>
      </div>
    </article>
  );
}
