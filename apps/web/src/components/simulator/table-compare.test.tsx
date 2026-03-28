import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TableCompare } from './table-compare';

describe('TableCompare', () => {
  it('renderiza totais por tabela', () => {
    const html = renderToStaticMarkup(
      <TableCompare
        tableIds={[1, 2]}
        onCompare={() => {}}
        result={{
          rows: [
            {
              serviceKey: 'coroa',
              quantity: 1,
              pricesByTable: { 1: 10000, 2: 11000 },
            },
          ],
          totalsByTable: { 1: 10000, 2: 11000 },
        }}
      />,
    );

    expect(html).toContain('R$ 100.00');
    expect(html).toContain('R$ 110.00');
  });
});
