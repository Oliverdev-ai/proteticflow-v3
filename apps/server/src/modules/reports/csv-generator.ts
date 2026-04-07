type FiscalCsvSection = {
  title: string;
  headers: string[];
  rows: string[][];
};

type GenerateFiscalCsvInput = {
  reportTitle: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  sections: FiscalCsvSection[];
};

function formatDateBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTimeBr(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function escapeCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[;"\r\n]/.test(escaped) ? `"${escaped}"` : escaped;
}

export function formatAmountBrFromCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrencyBrFromCents(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

export function generateFiscalCsv(input: GenerateFiscalCsvInput): string {
  const lines: string[] = [];
  lines.push(`Relatorio;${escapeCell(input.reportTitle)}`);
  lines.push(`Periodo;${escapeCell(`${formatDateBr(input.periodStart)} a ${formatDateBr(input.periodEnd)}`)}`);
  lines.push(`Gerado em;${escapeCell(formatDateTimeBr(input.generatedAt))}`);
  lines.push('');

  for (const section of input.sections) {
    lines.push(escapeCell(section.title));
    lines.push(section.headers.map(escapeCell).join(';'));
    for (const row of section.rows) {
      lines.push(row.map((cell) => escapeCell(cell)).join(';'));
    }
    lines.push('');
  }

  return `\uFEFF${lines.join('\r\n')}`;
}
