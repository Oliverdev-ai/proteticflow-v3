import { useRef, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

export function TrabalhoUploadZone({ jobId }: { jobId: number }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const utils = trpc.useUtils();
  const [message, setMessage] = useState('');
  const [uploading, setUploading] = useState(false);
  const getUploadUrl = trpc.job.getPresignedUploadUrl.useMutation();
  const confirmUpload = trpc.job.confirmUpload.useMutation();

  async function uploadFile(file: File) {
    setMessage('');
    if (!ALLOWED_TYPES.includes(file.type)) {
      setMessage('Tipo permitido: JPG, PNG ou PDF.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setMessage('Arquivo excede 10MB.');
      return;
    }

    setUploading(true);
    try {
      const presigned = await getUploadUrl.mutateAsync({
        jobId,
        filename: file.name,
        contentType: file.type as 'image/jpeg' | 'image/png' | 'application/pdf',
        sizeBytes: file.size,
      });

      const response = await fetch(presigned.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!response.ok) {
        throw new Error('Falha no upload para storage');
      }

      await confirmUpload.mutateAsync({
        jobId,
        key: presigned.key,
        filename: file.name,
      });
      await Promise.all([
        utils.job.get.invalidate({ id: jobId }),
        utils.job.listTimeline.invalidate({ jobId }),
      ]);
      setMessage('Arquivo anexado.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Falha ao anexar arquivo.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-5">
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card text-primary">
          {uploading ? <Loader2 className="animate-spin" size={22} /> : <FileUp size={22} />}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Anexar arquivo técnico</p>
          <p className="text-xs text-muted-foreground">JPG, PNG ou PDF até 10MB. URL presigned expira em 5 minutos.</p>
        </div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          Selecionar arquivo
        </button>
        {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
