import { useState, useRef } from 'react';
import { 
  Upload, Image as ImageIcon, 
  CheckCircle2, AlertCircle, Loader2,
  CloudUpload, Trash2
} from 'lucide-react';
import { useSettings } from '../../hooks/use-settings';
import { cn } from '../../lib/utils';
import { Large, Muted } from '../shared/typography';

const accepted = ['image/png', 'image/jpeg', 'image/webp'];

export function LogoUpload() {
  const { overview, uploadLogo, removeLogo } = useSettings();
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentLogo = overview.data?.identity.logoUrl;

  const onPick = async (file: File | null) => {
    setError(null);
    if (!file) return;
    if (!accepted.includes(file.type)) {
      setError('Formato não suportado. Use PNG, JPEG ou WEBP.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError('O arquivo excede o limite de 2MB.');
      return;
    }

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result;
          if (typeof result !== 'string') {
            reject(new Error('Falha na decodificação binária'));
            return;
          }
          const [, payload] = result.split(',');
          if (!payload) {
            reject(new Error('Payload Base64 corrompido'));
            return;
          }
          resolve(payload);
        };
        reader.onerror = () => reject(new Error('Falha crítica na leitura local'));
        reader.readAsDataURL(file);
      });
      
      uploadLogo.mutate({
        fileBase64: base64,
        mimeType: file.type as 'image/png' | 'image/jpeg' | 'image/webp',
        filename: file.name,
        sizeBytes: file.size,
      });
    } catch {
      setError('Erro ao processar imagem para upload.');
    }
  };

  return (
    <div className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-[32px] p-8 flex flex-col gap-8 relative overflow-hidden group/logo">
       <div className="flex items-center gap-4 relative">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
             <CloudUpload size={18} strokeWidth={3} />
          </div>
          <div className="flex flex-col gap-0.5">
             <Large className="tracking-tight text-lg font-black uppercase">Simbolismo Digital</Large>
             <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Gestão do Logotipo oficial da organização</Muted>
          </div>
       </div>

       <div className="flex flex-col lg:flex-row gap-10 items-center">
          {/* Preview Section */}
          <div className="relative group/preview">
             <div className={cn(
               "w-48 h-48 rounded-[40px] border-4 border-card shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-700 bg-muted/20 relative",
               currentLogo ? "ring-8 ring-primary/5" : "border-dashed border-border/60"
             )}>
                {currentLogo ? (
                  <img src={currentLogo} alt="Logo Laboratório" className="w-full h-full object-contain transition-transform duration-700 group-hover/preview:scale-110" />
                ) : (
                  <div className="flex flex-col items-center gap-3 opacity-20">
                     <ImageIcon size={40} strokeWidth={1.5} />
                     <span className="text-[10px] font-black uppercase tracking-widest">Aguardando</span>
                  </div>
                )}
                
                {uploadLogo.isPending && (
                  <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in">
                     <Loader2 size={32} className="animate-spin text-primary" />
                  </div>
                )}
             </div>
             
             {currentLogo && (
                <button 
                  onClick={() => removeLogo.mutate({})}
                  className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-destructive text-white shadow-xl flex items-center justify-center opacity-0 group-hover/preview:opacity-100 transition-all active:scale-90"
                >
                   <Trash2 size={16} strokeWidth={3} />
                </button>
             )}
          </div>

          {/* Upload Controls */}
          <div className="flex-1 flex flex-col gap-6">
             <div className="space-y-2">
                <p className="text-sm font-black text-foreground tracking-tight uppercase leading-none">Configurar Nova Identidade</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest opacity-60">Recomendamos arquivos PNG ou WebP com fundo transparente.</p>
             </div>

             <div className="flex flex-wrap gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 bg-primary text-primary-foreground px-8 py-4 rounded-2xl shadow-xl shadow-primary/20 transition-all hover:brightness-110 active:scale-95 disabled:opacity-30 text-[10px] font-black uppercase tracking-widest"
                >
                   <Upload size={16} strokeWidth={3} /> {currentLogo ? 'Substituir Logo' : 'Enviar Arquivo'}
                </button>
                
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/png,image/jpeg,image/webp" 
                  onChange={(e) => onPick(e.target.files?.[0] ?? null)} 
                  className="hidden" 
                />
             </div>

             {/* Error/Info States */}
             <div className="min-h-[40px]">
                {error && (
                  <div className="flex items-center gap-3 text-destructive animate-in slide-in-from-left-4">
                     <AlertCircle size={14} strokeWidth={3} />
                     <span className="text-[9px] font-black uppercase tracking-widest">{error}</span>
                  </div>
                )}
                
                {uploadLogo.isSuccess && (
                  <div className="flex items-center gap-3 text-emerald-500 animate-in slide-in-from-left-4">
                     <CheckCircle2 size={14} strokeWidth={3} />
                     <span className="text-[9px] font-black uppercase tracking-widest">Sincronismo Concluído</span>
                  </div>
                )}
             </div>
          </div>
       </div>

       {/* Security/Access info */}
       <div className="p-5 bg-muted/20 border border-border rounded-2xl flex items-start gap-4">
          <Muted className="text-[10px] font-black tracking-tight leading-relaxed uppercase opacity-60">
             A imagem do logotipo será utilizada em todas as ordens de serviço (PDF), relatórios de faturamento e comunicações oficiais enviadas por e-mail aos dentistas.
          </Muted>
       </div>

       <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.01] rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
    </div>
  );
}
