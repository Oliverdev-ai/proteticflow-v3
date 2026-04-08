import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { logger } from '../logger.js';
import { transcribeAudio } from '../modules/ai/voice.service.js';

const ORIGINAL_ENV = {
  STT_API_KEY: process.env.STT_API_KEY,
  STT_API_URL: process.env.STT_API_URL,
  STT_MODEL: process.env.STT_MODEL,
};

describe('F38 O2 - voice service', () => {
  beforeEach(() => {
    process.env.STT_API_KEY = 'test-stt-key';
    process.env.STT_API_URL = 'https://api.example.com/stt';
    process.env.STT_MODEL = 'whisper-1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.STT_API_KEY = ORIGINAL_ENV.STT_API_KEY;
    process.env.STT_API_URL = ORIGINAL_ENV.STT_API_URL;
    process.env.STT_MODEL = ORIGINAL_ENV.STT_MODEL;
  });

  it('1. transcreve audio com provider mockado', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        text: 'criar os para dr silva',
        confidence: 0.91,
        duration: 2.4,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await transcribeAudio({
      audioBuffer: Buffer.from('audio-data'),
      mimeType: 'audio/webm',
      tenantId: 10,
      userId: 11,
      durationMs: 2400,
    });

    expect(result.text).toBe('criar os para dr silva');
    expect(result.confidence).toBe(0.91);
    expect(result.durationMs).toBe(2400);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('2. audio acima de 10MB retorna BAD_REQUEST', async () => {
    const largeBuffer = Buffer.alloc(10 * 1024 * 1024 + 1);
    await expect(transcribeAudio({
      audioBuffer: largeBuffer,
      mimeType: 'audio/webm',
      tenantId: 1,
      userId: 2,
      durationMs: 1000,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('3. erro do provider retorna fallback amigavel', async () => {
    const fetchMock = vi.fn(async () => new Response('provider unavailable', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(transcribeAudio({
      audioBuffer: Buffer.from('audio-data'),
      mimeType: 'audio/webm',
      tenantId: 1,
      userId: 2,
      durationMs: 1000,
    })).rejects.toSatisfy((error: unknown) =>
      error instanceof TRPCError
      && error.code === 'BAD_GATEWAY'
      && error.message.includes('Nao consegui entender o audio'),
    );
  });

  it('4. STT_API_KEY ausente retorna erro claro', async () => {
    delete process.env.STT_API_KEY;

    await expect(transcribeAudio({
      audioBuffer: Buffer.from('audio-data'),
      mimeType: 'audio/webm',
      tenantId: 1,
      userId: 2,
      durationMs: 1000,
    })).rejects.toSatisfy((error: unknown) =>
      error instanceof TRPCError
      && error.code === 'BAD_REQUEST'
      && error.message.includes('Transcricao por voz nao configurada'),
    );
  });

  it('5. registra metadata sem audio no log', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({
        text: 'listar entregas de hoje',
        confidence: 0.82,
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const loggerSpy = vi.spyOn(logger, 'info');

    await transcribeAudio({
      audioBuffer: Buffer.from('audio-data'),
      mimeType: 'audio/webm',
      tenantId: 31,
      userId: 32,
      durationMs: 1200,
    });

    const firstCall = loggerSpy.mock.calls[0]?.[0];
    expect(firstCall).toMatchObject({
      action: 'ai.voice.transcribe',
      tenantId: 31,
      userId: 32,
      durationMs: 1200,
      charCount: 'listar entregas de hoje'.length,
    });
    expect(firstCall).not.toHaveProperty('audioBuffer');
    expect(firstCall).not.toHaveProperty('audio');
  });
});

