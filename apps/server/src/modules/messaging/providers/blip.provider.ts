import { randomUUID } from 'node:crypto';
import { env } from '../../../env.js';
import { logger } from '../../../logger.js';

export type BlipSendResult = { id: string };

export async function sendBlipWhatsApp(
  to: string,
  text: string,
): Promise<BlipSendResult> {
  if (!env.BLIP_API_TOKEN || !env.BLIP_FROM_NUMBER) {
    throw new Error('BLIP_API_TOKEN ou BLIP_FROM_NUMBER nao configurado');
  }

  const body = {
    id: randomUUID(),
    to: `${to}@wa.gw.msging.net`,
    type: 'text/plain',
    content: text,
  };

  const response = await fetch(`${env.BLIP_BASE_URL}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${env.BLIP_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    logger.error(
      { action: 'messaging.blip.send_error', status: response.status, detail },
      'Falha ao enviar WhatsApp via Blip',
    );
    throw new Error(`Blip HTTP ${response.status}: ${detail}`);
  }

  return { id: body.id };
}
