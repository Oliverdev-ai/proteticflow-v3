import { describe, expect, it } from 'vitest';
import { extractStorageKeyFromUrl } from './logo.js';

describe('settings/logo helpers', () => {
  it('extrai key do formato esperado', () => {
    const key = extractStorageKeyFromUrl('http://localhost:9000/proteticflow/tenants/1/branding/logo.png');
    expect(key).toBe('tenants/1/branding/logo.png');
  });

  it('retorna null quando url invalida', () => {
    expect(extractStorageKeyFromUrl('https://example.com/arquivo.png')).toBeNull();
  });
});
