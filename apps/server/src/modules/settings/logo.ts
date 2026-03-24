import { TRPCError } from '@trpc/server';
import { buildPublicUrl, deleteObject, uploadBuffer } from '../../core/storage.js';

type AllowedMime = 'image/png' | 'image/jpeg' | 'image/webp';

const MIME_TO_EXT: Record<AllowedMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export function extractStorageKeyFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = '/proteticflow/';
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

export async function uploadTenantLogo(tenantId: number, input: {
  fileBase64: string;
  mimeType: AllowedMime;
  sizeBytes: number;
}) {
  if (!MIME_TO_EXT[input.mimeType]) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Formato de imagem nao permitido' });
  }

  if (input.sizeBytes > 2 * 1024 * 1024) {
    throw new TRPCError({ code: 'PAYLOAD_TOO_LARGE', message: 'Logo excede limite de 2MB' });
  }

  const buffer = Buffer.from(input.fileBase64, 'base64');
  if (buffer.length !== input.sizeBytes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tamanho de arquivo inconsistente' });
  }

  const ext = MIME_TO_EXT[input.mimeType];
  const key = `tenants/${tenantId}/branding/logo.${ext}`;
  await uploadBuffer(key, buffer, input.mimeType);

  return {
    key,
    url: buildPublicUrl(key),
  };
}

export async function removeTenantLogoByUrl(url: string | null | undefined) {
  const key = extractStorageKeyFromUrl(url);
  if (!key) return;
  await deleteObject(key);
}
