export type Boleto = {
  id: number;
  tenantId: number;
  arId: number | null;
  clientId: number;
  gatewayId: string | null;
  nossoNumero: string | null;
  barcode: string | null;
  pixCopyPaste: string | null;
  pdfUrl: string | null;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled' | 'refunded';
  amountCents: number;
  dueDate: string;
  paidAt: string | null;
  createdAt: string;
};

export type Nfse = {
  id: number;
  tenantId: number;
  clientId: number;
  arId: number | null;
  closingId: number | null;
  nfseNumber: string | null;
  danfseUrl: string | null;
  status: 'draft' | 'pending' | 'issued' | 'cancelled' | 'error';
  serviceName: string;
  grossValueCents: number;
  issqnCents: number;
  netValueCents: number;
  tomadorName: string;
  issuedAt: string | null;
  createdAt: string;
};

export type FiscalSettings = {
  tenantId: number;
  municipalRegistration: string | null;
  taxRegime: string | null;
  defaultServiceCode: string | null;
  defaultServiceName: string | null;
  issqnRatePercent: string | null;
  asaasSandbox: boolean;
  focusSandbox: boolean;
  cityCode: string | null;
};
