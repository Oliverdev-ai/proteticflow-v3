export type Base64Artifact = {
  filename: string;
  mimeType: string;
  base64: string;
};

type BinaryPayload =
  | ArrayBuffer
  | Uint8Array
  | number[]
  | { type: 'Buffer'; data: number[] };

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

export function downloadBlobFile(filename: string, blob: Blob): void {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.URL.revokeObjectURL(url);
}

export function downloadBase64Artifact(artifact: Base64Artifact): void {
  const blob = base64ToBlob(artifact.base64, artifact.mimeType);
  downloadBlobFile(artifact.filename, blob);
}

export function downloadUtf8TextFile(
  filename: string,
  content: string,
  mimeType = 'text/plain; charset=utf-8',
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlobFile(filename, blob);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const normalized = base64.includes(',') ? base64.split(',').pop() ?? '' : base64;
  const binary = window.atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function pdfBlobFromBytes(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

function toPdfBlob(payload: BinaryPayload | string): Blob {
  if (payload instanceof ArrayBuffer) {
    return pdfBlobFromBytes(new Uint8Array(payload));
  }

  if (payload instanceof Uint8Array) {
    return pdfBlobFromBytes(payload);
  }

  if (Array.isArray(payload)) {
    return pdfBlobFromBytes(new Uint8Array(payload));
  }

  if (typeof payload === 'string') {
    return pdfBlobFromBytes(base64ToUint8Array(payload));
  }

  if (payload && payload.type === 'Buffer' && Array.isArray(payload.data)) {
    return pdfBlobFromBytes(new Uint8Array(payload.data));
  }

  throw new Error('Unsupported PDF payload format');
}

export function downloadPdfFromBinary(filename: string, payload: BinaryPayload | string): void {
  const blob = toPdfBlob(payload);
  downloadBlobFile(filename, blob);
}

export function openPdfFromBase64(base64: string): void {
  const blob = toPdfBlob(base64);
  const url = window.URL.createObjectURL(blob);
  const popup = window.open(url, '_blank', 'noopener,noreferrer');

  if (!popup) {
    downloadBlobFile('documento.pdf', blob);
  }

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 60_000);
}
