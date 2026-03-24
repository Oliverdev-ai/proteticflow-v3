import { describe, expect, it } from 'vitest';
import { renderToString } from 'react-dom/server';
import React from 'react';
import { RolesMatrix } from './roles-matrix';

describe('roles-matrix', () => {
  it('exibe modulos por role', () => {
    const html = renderToString(<RolesMatrix />);
    expect(html).toContain('settings');
    expect(html).toContain('reports');
    expect(html).toContain('portal');
    expect(html).toContain('ai');
  });
});
