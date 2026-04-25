import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../env.js';
import { sendBlipWhatsApp } from './providers/blip.provider.js';

const ORIGINAL_ENV = {
  BLIP_API_TOKEN: env.BLIP_API_TOKEN,
  BLIP_FROM_NUMBER: env.BLIP_FROM_NUMBER,
  BLIP_BASE_URL: env.BLIP_BASE_URL,
};

describe('blip.provider', () => {
  beforeEach(() => {
    env.BLIP_API_TOKEN = 'blip-token-test';
    env.BLIP_FROM_NUMBER = '5511999990000';
    env.BLIP_BASE_URL = 'https://http.msging.net';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    env.BLIP_API_TOKEN = ORIGINAL_ENV.BLIP_API_TOKEN;
    env.BLIP_FROM_NUMBER = ORIGINAL_ENV.BLIP_FROM_NUMBER;
    env.BLIP_BASE_URL = ORIGINAL_ENV.BLIP_BASE_URL;
  });

  it('serializa body e Authorization Key corretamente', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendBlipWhatsApp('5511999990000', 'Mensagem teste');

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

    await expect(sendBlipWhatsApp('5511999990000', 'Mensagem teste'))
      .rejects
      .toThrow(/Blip HTTP 400/i);
  });

  it('falha antes do fetch sem credenciais obrigatorias', async () => {
    env.BLIP_API_TOKEN = undefined;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendBlipWhatsApp('5511999990000', 'Mensagem teste'))
      .rejects
      .toThrow('BLIP_API_TOKEN ou BLIP_FROM_NUMBER nao configurado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
