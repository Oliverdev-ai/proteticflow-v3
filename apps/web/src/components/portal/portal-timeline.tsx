import type { PublicPortalJob, PublicPortalTimelineItem } from '@proteticflow/shared';

type PortalTimelineProps = {
  jobs: PublicPortalJob[];
  timelineByJob: Record<number, PublicPortalTimelineItem[]>;
};

export function PortalTimeline({ jobs, timelineByJob }: PortalTimelineProps) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-zinc-900 mb-4">Timeline das OS</h2>
      <div className="space-y-5">
        {jobs.map((job) => (
          <article key={job.id} className="border border-zinc-200 rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900">{job.code}</h3>
                <p className="text-xs text-zinc-600">
                  {job.prothesisType ?? 'Protese'} {job.material ? `- ${job.material}` : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-zinc-500">Status</p>
                <p className="text-sm font-medium text-zinc-800">{job.status}</p>
              </div>
            </div>
            <ul className="space-y-2">
              {(timelineByJob[job.id] ?? []).map((item) => (
                <li key={item.id} className="text-sm text-zinc-700 flex items-start justify-between gap-3">
                  <div>
                    <span className="font-medium text-zinc-900">{item.toStatus}</span>
                    {item.notes ? <span className="text-zinc-600"> - {item.notes}</span> : null}
                  </div>
                  <span className="text-xs text-zinc-500 whitespace-nowrap">
                    {new Date(item.createdAt).toLocaleString('pt-BR')}
                  </span>
                </li>
              ))}
              {(timelineByJob[job.id] ?? []).length === 0 ? (
                <li className="text-sm text-zinc-500">Sem eventos de timeline para esta OS.</li>
              ) : null}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
