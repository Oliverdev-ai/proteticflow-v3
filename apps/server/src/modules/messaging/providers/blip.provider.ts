import { randomUUID } from 'node:crypto';
import { logger } from '../../../logger.js';

export type BlipSendResult = { id: string };
export type BlipProviderConfig = {
  apiToken: string;
  fromNumber: string;
  baseUrl?: string;
};

export async function sendBlipWhatsApp(
  config: BlipProviderConfig,
  to: string,
  text: string,
): Promise<BlipSendResult> {
  if (!config.apiToken || !config.fromNumber) {
    throw new Error('Configuracao Blip incompleta para o tenant');
  }

  const body = {
    id: randomUUID(),
    to: `${to}@wa.gw.msging.net`,
    type: 'text/plain',
    content: text,
  };

  const baseUrl = config.baseUrl ?? 'https://http.msging.net';
  const response = await fetch(`${baseUrl}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Key ${config.apiToken}`,
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
