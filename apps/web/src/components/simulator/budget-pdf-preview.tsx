type BudgetPdfPreviewProps = {
  pdfBase64: string | null;
};

export function BudgetPdfPreview({ pdfBase64 }: BudgetPdfPreviewProps) {
  if (!pdfBase64) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-400">
        Gere ou envie um orcamento para visualizar o PDF.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-3">
      <iframe
        title="Preview PDF Orcamento"
        src={`data:application/pdf;base64,${pdfBase64}`}
        className="w-full h-[480px] rounded-lg bg-white"
      />
    </div>
  );
}
