import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScenarioPanel } from './scenario-panel';

describe('ScenarioPanel', () => {
  it('renderiza total e margem quando preview existe', () => {
    const html = renderToStaticMarkup(
      <ScenarioPanel
        preview={{
          subtotalCents: 10000,
          adjustedSubtotalCents: 10000,
          totalCents: 9500,
          estimatedCostCents: 6000,
          estimatedMarginCents: 3500,
          estimatedMarginPercent: 36.84,
          lines: [],
        }}
        onPreview={() => {}}
      />,
    );

    expect(html).toContain('R$ 95.00');
    expect(html).toContain('36.84%');
  });
});
