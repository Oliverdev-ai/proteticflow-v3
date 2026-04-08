import { TRPCError } from '@trpc/server';

export type AsaasCreatePaymentInput = {
  customer: string;
  billingType: 'BOLETO';
  value: number;
  dueDate: string;
  description?: string;
};

export type AsaasPaymentResponse = {
  id: string;
  nossoNumero: string;
  barCode: string | null;
  pixQrCodeImage?: string;
  bankSlipUrl: string;
};

export type AsaasPaymentStatusResponse = {
  status: string;
  paidAt: Date | null;
  paidValueCents: number | null;
};

type AsaasCustomer = { id: string };
type AsaasListCustomerResponse = { data?: AsaasCustomer[] };

const ASAAS_BASE = (sandbox: boolean) =>
  sandbox ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/api/v3';

function toDigits(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

async function parseAsaasJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Resposta invalida do gateway Asaas',
    });
  }
}

async function asaasRequest<T>(
  apiKey: string,
  sandbox: boolean,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${ASAAS_BASE(sandbox)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      access_token: apiKey,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Erro no gateway Asaas (${response.status}): ${body}`,
    });
  }

  return parseAsaasJson<T>(response);
}

export async function getOrCreateAsaasCustomer(
  apiKey: string,
  sandbox: boolean,
  client: { name: string; cpfCnpj: string | null; email: string | null },
): Promise<string> {
  const cpfCnpj = toDigits(client.cpfCnpj);

  if (cpfCnpj) {
    const query = new URLSearchParams({
      cpfCnpj,
      limit: '1',
    });

    const found = await asaasRequest<AsaasListCustomerResponse>(
      apiKey,
      sandbox,
      `/customers?${query.toString()}`,
      { method: 'GET' },
    );

    const existingId = found.data?.[0]?.id;
    if (existingId) return existingId;
  }

  const payload = {
    name: client.name,
    cpfCnpj: cpfCnpj ?? undefined,
    email: client.email ?? undefined,
  };

  const created = await asaasRequest<AsaasCustomer>(
    apiKey,
    sandbox,
    '/customers',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  );

  if (!created.id) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Falha ao criar customer no Asaas' });
  }

  return created.id;
}

export async function createAsaasBoleto(
  apiKey: string,
  sandbox: boolean,
  input: AsaasCreatePaymentInput,
): Promise<AsaasPaymentResponse> {
  const response = await asaasRequest<Record<string, unknown>>(
    apiKey,
    sandbox,
    '/payments',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  const pixQrCodeImage = typeof response.pixQrCodeImage === 'string' ? response.pixQrCodeImage : null;

  return {
    id: String(response.id ?? ''),
    nossoNumero: String(response.nossoNumero ?? ''),
    barCode: typeof response.identificationField === 'string'
      ? response.identificationField
      : typeof response.barCode === 'string'
        ? response.barCode
        : null,
    bankSlipUrl: String(response.bankSlipUrl ?? ''),
    ...(pixQrCodeImage ? { pixQrCodeImage } : {}),
  };
}

export async function cancelAsaasBoleto(
  apiKey: string,
  sandbox: boolean,
  gatewayId: string,
): Promise<void> {
  await asaasRequest<unknown>(apiKey, sandbox, `/payments/${gatewayId}`, {
    method: 'DELETE',
  });
}

export async function queryAsaasBoleto(
  apiKey: string,
  sandbox: boolean,
  gatewayId: string,
): Promise<AsaasPaymentStatusResponse> {
  const response = await asaasRequest<Record<string, unknown>>(
    apiKey,
    sandbox,
    `/payments/${gatewayId}`,
    { method: 'GET' },
  );

  const rawPaidAt = response.clientPaymentDate ?? response.paymentDate;
  const paidAt = typeof rawPaidAt === 'string' ? new Date(rawPaidAt) : null;
  const paidValueCents = parseMoneyToCents(response.value);

  return {
    status: typeof response.status === 'string' ? response.status : 'PENDING',
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    paidValueCents,
  };
}

function parseMoneyToCents(value: unknown): number | null {
  if (typeof value === 'number') return Math.round(value * 100);
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return Math.round(parsed * 100);
  }
  return null;
}

export function parseAsaasWebhookPayment(payload: unknown): {
  gatewayId: string;
  status: 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED';
  paidAt: Date | null;
  paidValueCents: number | null;
} {
  if (!payload || typeof payload !== 'object') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Webhook Asaas invalido' });
  }

  const root = payload as Record<string, unknown>;
  const payment = (root.payment && typeof root.payment === 'object'
    ? root.payment as Record<string, unknown>
    : root);

  const gatewayId = typeof payment.id === 'string' ? payment.id : '';
  const rawStatus = typeof payment.status === 'string' ? payment.status.toUpperCase() : '';

  if (!gatewayId || !rawStatus) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Payload Asaas sem identificador/status' });
  }

  if (!['RECEIVED', 'CONFIRMED', 'OVERDUE', 'REFUNDED'].includes(rawStatus)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Status Asaas nao suportado: ${rawStatus}` });
  }

  const paidAtRaw = payment.clientPaymentDate ?? payment.paymentDate;
  const paidAt = typeof paidAtRaw === 'string' ? new Date(paidAtRaw) : null;
  const paidValueCents = parseMoneyToCents(payment.value);

  return {
    gatewayId,
    status: rawStatus as 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED',
    paidAt: paidAt && !Number.isNaN(paidAt.getTime()) ? paidAt : null,
    paidValueCents,
  };
}
