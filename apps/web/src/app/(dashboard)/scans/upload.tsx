import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../../../lib/trpc';
import { ArrowLeft, UploadCloud, Loader2 } from 'lucide-react';

type UploadFiles = {
  stlUpper: File | null;
  stlLower: File | null;
  xml: File | null;
  gallery: File | null;
};

type FileSlot = keyof UploadFiles;

const FILE_RULES: Record<FileSlot, { maxBytes: number; extensions: string[]; label: string }> = {
  stlUpper: { maxBytes: 20 * 1024 * 1024, extensions: ['stl'], label: 'STL Arcada Superior' },
  stlLower: { maxBytes: 20 * 1024 * 1024, extensions: ['stl'], label: 'STL Arcada Inferior' },
  xml: { maxBytes: 5 * 1024 * 1024, extensions: ['xml'], label: 'XML do Scanner' },
  gallery: { maxBytes: 10 * 1024 * 1024, extensions: ['png', 'jpg', 'jpeg', 'webp'], label: 'Imagem de Referencia' },
};

function extensionFromFilename(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  return ext ?? '';
}

function formatMegabytes(bytes: number): string {
  return `${Math.floor(bytes / (1024 * 1024))}MB`;
}

function validateFile(slot: FileSlot, file: File): string | null {
  const rule = FILE_RULES[slot];

  if (file.size > rule.maxBytes) {
    return `${rule.label} excede o limite de ${formatMegabytes(rule.maxBytes)}.`;
  }

  const extension = extensionFromFilename(file.name);
  if (!rule.extensions.includes(extension)) {
    return `${rule.label}: extensao invalida. Permitido: ${rule.extensions.join(', ')}.`;
  }

  return null;
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result;
      if (typeof data !== 'string') return reject(new Error('Falha ao ler arquivo'));
      const [, base64] = data.split(',');
      if (!base64) return reject(new Error('Base64 invalido'));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

export default function ScanUploadPage() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [scannerType, setScannerType] = useState<
    'itero' | 'medit' | '3shape' | 'carestream' | 'outro'
  >('outro');
  const [jobId, setJobId] = useState('');
  const [clientId, setClientId] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<UploadFiles>({
    stlUpper: null,
    stlLower: null,
    xml: null,
    gallery: null,
  });
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);

  const createScan = trpc.scan.create.useMutation();
  const uploadFile = trpc.scan.uploadFile.useMutation();

  function handleFileChange(slot: FileSlot, file: File | null) {
    if (!file) {
      setFiles((prev) => ({ ...prev, [slot]: null }));
      return;
    }

    const validationError = validateFile(slot, file);
    if (validationError) {
      setError(validationError);
      setFiles((prev) => ({ ...prev, [slot]: null }));
      return;
    }

    setError('');
    setFiles((prev) => ({ ...prev, [slot]: file }));
  }

  async function handleSubmit() {
    setError('');
    setProgress(0);
    if (!files.stlUpper && !files.stlLower && !files.xml && !files.gallery) {
      setError('Selecione pelo menos um arquivo para upload.');
      return;
    }

    try {
      const created = await createScan.mutateAsync({
        scannerType,
        jobId: jobId ? Number(jobId) : undefined,
        clientId: clientId ? Number(clientId) : undefined,
        notes: notes || undefined,
      });

      const toUpload: Array<{
        slot: FileSlot;
        fileType: 'stl_upper' | 'stl_lower' | 'xml' | 'gallery';
        file: File | null;
      }> = [
        { slot: 'stlUpper', fileType: 'stl_upper', file: files.stlUpper },
        { slot: 'stlLower', fileType: 'stl_lower', file: files.stlLower },
        { slot: 'xml', fileType: 'xml', file: files.xml },
        { slot: 'gallery', fileType: 'gallery', file: files.gallery },
      ];

      const validItems = toUpload.filter((item) => item.file);
      let uploadedCount = 0;

      for (const item of toUpload) {
        if (!item.file) continue;
        const validationError = validateFile(item.slot, item.file);
        if (validationError) {
          throw new Error(validationError);
        }
        const base64Content = await toBase64(item.file);
        await uploadFile.mutateAsync({
          scanId: created.id,
          fileType: item.fileType,
          base64Content,
          filename: item.file.name,
        });
        uploadedCount += 1;
        setProgress(Math.round((uploadedCount / validItems.length) * 100));
      }

      await utils.scan.list.invalidate();
      navigate(`/scans/${created.id}`);
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Falha ao enviar scan');
      setProgress(0);
    }
  }

  const loading = createScan.isPending || uploadFile.isPending;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => navigate('/scans')}
        className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"
      >
        <ArrowLeft size={14} />
        Voltar
      </button>

      <div>
        <h1 className="text-2xl font-bold text-white">Upload de Scan 3D</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Envie STL superior/inferior, XML e imagem de referencia.
        </p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Scanner</label>
            <select
              value={scannerType}
              onChange={(e) => setScannerType(e.target.value as typeof scannerType)}
              className="input-field w-full"
            >
              <option value="outro">Outro</option>
              <option value="itero">iTero</option>
              <option value="medit">Medit</option>
              <option value="3shape">3Shape</option>
              <option value="carestream">Carestream</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">ID da OS (opcional)</label>
            <input
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              type="number"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">ID do cliente (opcional)</label>
            <input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              type="number"
              className="input-field w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Observações</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field w-full"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">STL Arcada Superior</label>
            <input
              type="file"
              accept=".stl"
              onChange={(e) => handleFileChange('stlUpper', e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">STL Arcada Inferior</label>
            <input
              type="file"
              accept=".stl"
              onChange={(e) => handleFileChange('stlLower', e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">XML do Scanner</label>
            <input
              type="file"
              accept=".xml,text/xml"
              onChange={(e) => handleFileChange('xml', e.target.files?.[0] ?? null)}
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Imagem de Referencia</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange('gallery', e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        {error && <div className="text-red-400 text-sm">{error}</div>}
        {loading && <div className="text-zinc-300 text-sm">Upload em andamento: {progress}%</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full px-4 py-3 bg-primary hover:bg-primary disabled:opacity-60 text-white rounded-xl font-medium flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
          Enviar Scan
        </button>
      </div>
    </div>
  );
}
