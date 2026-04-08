const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(cents: number) {
  return brlFormatter.format(cents / 100);
}

