import { randomUUID } from 'crypto';
import { TRPCError } from '@trpc/server';

export type FocusEmitInput = {
  cnpj_prestador: string;
  inscricao_municipal: string;
  data_emissao: string;
  tomador: {
    cpf_cnpj: string | null;
    razao_social: string;
    email: string | null;
  };
  servicos: Array<{
    descricao: string;
    codigo_tributario_municipio: string;
    valor_servicos: number;
    aliquota: number;
  }>;
};

const FOCUS_BASE = (sandbox: boolean) =>
  sandbox ? 'https://homologacao.focusnfe.com.br/v2' : 'https://api.focusnfe.com.br/v2';

function focusAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString('base64')}`;
}

async function parseFocusJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Resposta invalida do gateway Focus NFe',
    });
  }
}

async function focusRequest<T>(
  token: string,
  sandbox: boolean,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${FOCUS_BASE(sandbox)}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: focusAuthHeader(token),
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Erro no gateway Focus NFe (${response.status}): ${body}`,
    });
  }

  return parseFocusJson<T>(response);
}

export async function emitFocusNfse(
  token: string,
  sandbox: boolean,
  input: FocusEmitInput,
): Promise<{ ref: string; status: string; numero?: string; verificador?: string; pdf_url?: string }> {
  const ref = `nfse-${Date.now()}-${randomUUID().slice(0, 8)}`;

  const response = await focusRequest<Record<string, unknown>>(
    token,
    sandbox,
    `/nfse?ref=${encodeURIComponent(ref)}`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  const numero = typeof response.numero === 'string' ? response.numero : null;
  const verificador = typeof response.codigo_verificacao === 'string' ? response.codigo_verificacao : null;
  const pdfUrl = typeof response.url_danfse === 'string' ? response.url_danfse : null;

  return {
    ref,
    status: String(response.status ?? 'pending'),
    ...(numero ? { numero } : {}),
    ...(verificador ? { verificador } : {}),
    ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
  };
}

export async function queryFocusNfse(
  token: string,
  sandbox: boolean,
  ref: string,
): Promise<{ status: string; numero?: string; pdf_url?: string; xml_url?: string }> {
  const response = await focusRequest<Record<string, unknown>>(
    token,
    sandbox,
    `/nfse/${encodeURIComponent(ref)}`,
    { method: 'GET' },
  );

  const numero = typeof response.numero === 'string' ? response.numero : null;
  const pdfUrl = typeof response.url_danfse === 'string' ? response.url_danfse : null;
  const xmlUrl = typeof response.url_xml === 'string' ? response.url_xml : null;

  return {
    status: String(response.status ?? 'pending'),
    ...(numero ? { numero } : {}),
    ...(pdfUrl ? { pdf_url: pdfUrl } : {}),
    ...(xmlUrl ? { xml_url: xmlUrl } : {}),
  };
}

export async function cancelFocusNfse(
  token: string,
  sandbox: boolean,
  ref: string,
  reason: string,
): Promise<void> {
  await focusRequest<unknown>(
    token,
    sandbox,
    `/nfse/${encodeURIComponent(ref)}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ justificativa: reason }),
    },
  );
}
