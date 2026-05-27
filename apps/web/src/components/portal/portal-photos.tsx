import type { PublicPortalJob, PublicPortalPhoto } from '@proteticflow/shared';

type PortalPhotosProps = {
  jobs: PublicPortalJob[];
  photosByJob: Record<number, PublicPortalPhoto[]>;
};

export function PortalPhotos({ jobs, photosByJob }: PortalPhotosProps) {
  return (
    <section className="rounded-lg border border-border bg-white p-5">
      <h2 className="text-lg font-semibold text-muted-foreground mb-4">Fotos publicas</h2>
      <div className="space-y-5">
        {jobs.map((job) => {
          const photos = photosByJob[job.id] ?? [];
          return (
            <article key={job.id}>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">{job.code}</h3>
              {photos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem fotos publicas para esta OS.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <figure key={photo.id} className="rounded-lg overflow-hidden border border-border bg-muted">
                      <img
                        src={photo.thumbnailUrl ?? photo.url}
                        alt={photo.description ?? `Foto da ${job.code}`}
                        className="w-full h-24 object-cover"
                      />
                      {photo.description ? (
                        <figcaption className="px-2 py-1 text-xs text-muted-foreground">{photo.description}</figcaption>
                      ) : null}
                    </figure>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
