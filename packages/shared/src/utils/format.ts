/**
 * Formata valor em centavos para BRL
 * Ex: 15000 → "R$ 150,00"
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

/**
 * "R$ 150,00" -> 15000 (centavos)
 */
export function parseBRL(value: string): number {
  const normalized = value
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = Number.parseFloat(normalized || '0');
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

/**
 * 15000 -> "150,00" (para exibir em input)
 */
export function formatBRLInput(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Formata data ISO para pt-BR
 * Ex: "2024-01-15" → "15/01/2024"
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
}

/**
 * Gera slug a partir de string
 * Ex: "Lab São Paulo" → "lab-sao-paulo"
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
