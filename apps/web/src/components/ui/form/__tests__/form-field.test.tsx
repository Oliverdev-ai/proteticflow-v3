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

  it('propagates aria-describedby to children via htmlFor/id', () => {
    const html = renderToStaticMarkup(
      <FormField label="Categoria" hint="Escolha uma categoria">
        <select />
      </FormField>,
    );

    expect(html).toContain('for=');
    expect(html).toContain('id=');
    expect(html).toContain('aria-describedby=');
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
