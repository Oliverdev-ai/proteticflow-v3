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
