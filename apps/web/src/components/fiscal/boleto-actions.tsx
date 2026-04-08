import type { Boleto } from '@proteticflow/shared';

type BoletoActionsProps = {
  boleto: Boleto;
  isBusy?: boolean;
  onSync: (boletoId: number) => void;
  onCancel: (boletoId: number) => void;
};

export function BoletoActions({ boleto, isBusy = false, onSync, onCancel }: BoletoActionsProps) {
  async function handleCopyPix(): Promise<void> {
    if (!boleto.pixCopyPaste) return;
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(boleto.pixCopyPaste);
  }

  function handleOpenPdf(): void {
    if (!boleto.pdfUrl) return;
    window.open(boleto.pdfUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onSync(boleto.id)}
        disabled={isBusy}
        className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 disabled:opacity-50"
      >
        Sincronizar
      </button>
      <button
        type="button"
        onClick={() => onCancel(boleto.id)}
        disabled={isBusy || boleto.status === 'paid' || boleto.status === 'cancelled'}
        className="px-2 py-1 rounded bg-rose-700 hover:bg-rose-600 text-xs text-white disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="button"
        onClick={handleCopyPix}
        disabled={isBusy || !boleto.pixCopyPaste}
        className="px-2 py-1 rounded bg-sky-700 hover:bg-sky-600 text-xs text-white disabled:opacity-50"
      >
        Copiar Pix
      </button>
      <button
        type="button"
        onClick={handleOpenPdf}
        disabled={isBusy || !boleto.pdfUrl}
        className="px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-xs text-white disabled:opacity-50"
      >
        Abrir PDF
      </button>
    </div>
  );
}
