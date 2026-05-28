import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendBlipWhatsApp } from './providers/blip.provider.js';

const defaultConfig = {
  apiToken: 'blip-token-test',
  fromNumber: '5511999990000',
  baseUrl: 'https://http.msging.net',
};

describe('blip.provider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('serializa body e Authorization Key corretamente', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBlipWhatsApp(defaultConfig, '5511999990000', 'Mensagem teste');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    if (!firstCall) {
      throw new Error('fetch nao foi chamado');
    }
    const [url, init = {}] = firstCall;
    expect(url).toBe('https://http.msging.net/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Key blip-token-test',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(String(init.body)) as {
      id: string;
      to: string;
      type: string;
      content: string;
    };
    expect(body.to).toBe('5511999990000@wa.gw.msging.net');
    expect(body.type).toBe('text/plain');
    expect(body.content).toBe('Mensagem teste');
    expect(result.id).toBe(body.id);
  });

  it('retorna erro com status HTTP em resposta 4xx', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('invalid destination', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendBlipWhatsApp(defaultConfig, '5511999990000', 'Mensagem teste'))
      .rejects
      .toThrow(/Blip HTTP 400/i);
  });

  it('falha antes do fetch sem credenciais obrigatorias', async () => {
    const brokenConfig = { ...defaultConfig, apiToken: '' };
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendBlipWhatsApp(brokenConfig, '5511999990000', 'Mensagem teste'))
      .rejects
      .toThrow('Configuracao Blip incompleta para o tenant');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
