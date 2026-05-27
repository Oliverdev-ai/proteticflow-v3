import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FormField } from '../form-field';

describe('FormField', () => {
  it('renders label + children', () => {
    const html = renderToStaticMarkup(
      <FormField label="Cidade">
        <select>
          <option value="sp">São Paulo</option>
        </select>
      </FormField>,
    );

    expect(html).toContain('Cidade');
    expect(html).toContain('<select');
  });

  it('shows error with role=alert when error prop present', () => {
    const html = renderToStaticMarkup(
      <FormField label="Tipo" error="Campo obrigatório">
        <select />
      </FormField>,
    );

    expect(html).toContain('Campo obrigatório');
    expect(html).toContain('role="alert"');
  });

  it('hides hint when error present', () => {
    const html = renderToStaticMarkup(
      <FormField label="Observações" hint="Dica" error="Erro">
        <textarea />
      </FormField>,
    );

    expect(html).toContain('Erro');
    expect(html).not.toContain('Dica');
  });

  it('propagates matching htmlFor/id and aria-describedby to children', () => {
    const html = renderToStaticMarkup(
      <FormField label="Categoria" hint="Escolha uma categoria">
        <select />
      </FormField>,
    );

    const labelFor = html.match(/<label[^>]*for="([^"]+)"/)?.[1];
    const selectId = html.match(/<select[^>]*id="([^"]+)"/)?.[1];
    const describedBy = html.match(/<select[^>]*aria-describedby="([^"]+)"/)?.[1];

    expect(labelFor).toBeDefined();
    expect(selectId).toBeDefined();
    expect(labelFor).toBe(selectId);
    expect(describedBy).toBe(`${selectId}-hint`);
    expect(html).toContain(`id="${selectId}-hint"`);
  });

  it('sets aria-invalid on child when error is present', () => {
    const html = renderToStaticMarkup(
      <FormField label="Categoria" error="Obrigatório">
        <select />
      </FormField>,
    );

    expect(html).toContain('aria-invalid="true"');
  });

  it('renders asterisk when required', () => {
    const html = renderToStaticMarkup(
      <FormField label="Fornecedor" required>
        <select />
      </FormField>,
    );

    expect(html).toContain('*');
  });
});
