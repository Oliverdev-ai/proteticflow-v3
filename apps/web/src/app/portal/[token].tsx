import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { trpc } from '../../lib/trpc';
import { PortalHeader } from '../../components/portal/portal-header';
import { PortalTimeline } from '../../components/portal/portal-timeline';
import { PortalPhotos } from '../../components/portal/portal-photos';
import { PortalEmpty } from '../../components/portal/portal-empty';
import { PortalError } from '../../components/portal/portal-error';

export default function PublicPortalPage() {
  const { token } = useParams<{ token: string }>();

  const query = trpc.portal.getPortalByToken.useQuery(
    { token: token ?? '' },
    { enabled: Boolean(token) },
  );

  const snapshot = query.data;
  const hasJobs = useMemo(() => (snapshot?.jobs.length ?? 0) > 0, [snapshot?.jobs.length]);

  return (
    <div className="min-h-screen bg-neutral-100 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {query.isLoading ? (
          <section className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
            Carregando portal...
          </section>
        ) : null}

        {query.isError ? (
          <PortalError message={query.error.message} />
        ) : null}

        {snapshot ? (
          <>
            <PortalHeader
              tenantName={snapshot.tenantName}
              tenantLogoUrl={snapshot.tenantLogoUrl}
              tenantPrimaryColor={snapshot.tenantPrimaryColor}
              clientName={snapshot.clientName}
            />

            {hasJobs ? (
              <>
                <PortalTimeline jobs={snapshot.jobs} timelineByJob={snapshot.timelineByJob} />
                <PortalPhotos jobs={snapshot.jobs} photosByJob={snapshot.photosByJob} />
              </>
            ) : (
              <PortalEmpty />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
