import { expect, test } from '@playwright/test';
import { loginManager, requireManagerE2E } from './support/auth';

test.describe('flow voice secure e2e', () => {
  test('push-to-talk gera preview, permite editar e enviar', async ({ page }) => {
    requireManagerE2E();

    await page.addInitScript(() => {
      class MockMediaRecorder {
        public static isTypeSupported() {
          return true;
        }

        public mimeType: string;
        public state: 'inactive' | 'recording' = 'inactive';
        public ondataavailable: ((event: { data: Blob }) => void) | null = null;
        public onstop: (() => void) | null = null;
        public onerror: (() => void) | null = null;

        public constructor(_stream: unknown, options?: { mimeType?: string }) {
          this.mimeType = options?.mimeType ?? 'audio/webm';
        }

        public start() {
          this.state = 'recording';
        }

        public stop() {
          if (this.state !== 'recording') return;
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob(['audio-mock'], { type: this.mimeType }) });
          this.onstop?.();
        }
      }

      const mediaDevices = {
        getUserMedia: async () => ({
          getTracks: () => [{ stop: () => undefined }],
        }),
      };

      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        writable: true,
        value: MockMediaRecorder,
      });

      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: mediaDevices,
      });
    });

    await page.route('**/trpc/ai.transcribe*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            result: {
              data: {
                text: 'agendar prova para amanha',
                confidence: 0.88,
                durationMs: 1800,
              },
            },
          },
        ]),
      });
    });

    await page.route('**/trpc/ai.executeCommand*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            result: {
              data: {
                status: 'executed',
                message: 'Comando jobs.listPending executado com sucesso.',
                run: {
                  id: 999001,
                  intent: 'jobs.listPending',
                  executionStatus: 'success',
                  createdAt: new Date().toISOString(),
                },
              },
            },
          },
        ]),
      });
    });

    await loginManager(page);
    await page.goto('/flow-ia', { waitUntil: 'domcontentloaded' });

    await page.locator('#flow-voice-button').click();
    await page.waitForTimeout(200);
    await page.locator('#flow-voice-button').click();

    const transcript = page.locator('#flow-transcript-text');
    await expect(transcript).toBeVisible({ timeout: 15000 });
    await expect(transcript).toHaveValue(/agendar prova para amanha/i);

    await transcript.fill('agendar prova para quinta de manha');
    await page.locator('#flow-transcript-send').click();

    await expect(page.getByText(/Comando jobs\.listPending executado com sucesso/i)).toBeVisible({
      timeout: 15000,
    });
    await expect(page.locator('#flow-transcript-text')).toHaveCount(0);
  });
});
