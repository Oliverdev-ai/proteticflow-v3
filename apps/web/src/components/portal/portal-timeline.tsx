import type { PublicPortalJob, PublicPortalTimelineItem } from '@proteticflow/shared';

type PortalTimelineProps = {
  jobs: PublicPortalJob[];
  timelineByJob: Record<number, PublicPortalTimelineItem[]>;
};

export function PortalTimeline({ jobs, timelineByJob }: PortalTimelineProps) {
  return (
    <section className="rounded-lg border border-border bg-white p-5">
      <h2 className="text-lg font-semibold text-muted-foreground mb-4">Timeline das OS</h2>
      <div className="space-y-5">
        {jobs.map((job) => (
          <article key={job.id} className="border border-border rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground">{job.code}</h3>
                <p className="text-xs text-muted-foreground">
                  {job.prothesisType ?? 'Protese'} {job.material ? `- ${job.material}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="text-sm font-medium text-muted-foreground">{job.status}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {(timelineByJob[job.id] ?? []).map((item) => (
                <li key={item.id} className="text-sm text-muted-foreground flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium text-muted-foreground">{item.toStatus}</span>
                    {item.notes ? <span className="text-muted-foreground"> - {item.notes}</span> : null}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </li>
              ))}
              {(timelineByJob[job.id] ?? []).length === 0 ? (
                <li className="text-sm text-muted-foreground">Sem eventos de timeline para esta OS.</li>
              ) : null}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
