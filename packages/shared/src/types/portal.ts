export interface PublicPortalJob {
  id: number;
  code: string;
  patientName: string | null;
  prothesisType: string | null;
  material: string | null;
  color: string | null;
  status: string;
  deadline: string;
  deliveredAt: string | null;
}

export interface PublicPortalTimelineItem {
  id: number;
  toStatus: string;
  notes: string | null;
  createdAt: string;
}

export interface PublicPortalPhoto {
  id: number;
  url: string;
  thumbnailUrl: string | null;
  description: string | null;
  createdAt: string;
}

export interface PublicPortalSnapshot {
  tenantName: string;
  tenantLogoUrl: string | null;
  tenantPrimaryColor: string | null;
  clientName: string;
  jobs: PublicPortalJob[];
  timelineByJob: Record<number, PublicPortalTimelineItem[]>;
  photosByJob: Record<number, PublicPortalPhoto[]>;
}
