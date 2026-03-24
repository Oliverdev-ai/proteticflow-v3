import { useState } from 'react';
import { useSettings } from '../../hooks/use-settings';

const accepted = ['image/png', 'image/jpeg', 'image/webp'];

export function LogoUpload() {
  const { overview, uploadLogo, removeLogo } = useSettings();
  const [error, setError] = useState<string | null>(null);

  const currentLogo = overview.data?.identity.logoUrl;

  const onPick = async (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!accepted.includes(file.type)) {
      setError('Apenas PNG, JPEG e WEBP');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('Arquivo acima de 2MB');
      return;
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') {
          reject(new Error('Falha ao ler arquivo'));
          return;
        }
        const [, payload] = result.split(',');
        if (!payload) {
          reject(new Error('Base64 invalido'));
          return;
        }
        resolve(payload);
      };
      reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
      reader.readAsDataURL(file);
    });
    uploadLogo.mutate({
      fileBase64: base64,
      mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
      filename: file.name,
      sizeBytes: file.size,
    });
  };

  return (
    <div className="space-y-3">
      <h4 className="text-white font-medium">Logo</h4>
      {currentLogo ? (
        <img src={currentLogo} alt="Logo atual" className="w-20 h-20 rounded-lg border border-neutral-700 object-cover" />
      ) : (
        <div className="w-20 h-20 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-xs text-neutral-500">sem logo</div>
      )}

      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => onPick(e.target.files?.[0] ?? null)} className="text-sm text-neutral-300" />
      {error && <p className="text-xs text-red-400">{error}</p>}

      <button onClick={() => removeLogo.mutate({})} className="bg-neutral-700 hover:bg-neutral-600 text-white px-4 py-2 rounded-lg text-sm">
        Remover logo
      </button>
    </div>
  );
}
