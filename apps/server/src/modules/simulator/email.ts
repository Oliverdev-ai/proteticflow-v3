import { logger } from '../../logger.js';

type SendSimulationEmailInput = {
  tenantId: number;
  simulationId: number;
  to: string;
  subject: string;
  pdfBase64: string;
};

export async function sendSimulationEmail(input: SendSimulationEmailInput) {
  logger.info(
    {
      action: 'simulator.email.send.stub',
      tenantId: input.tenantId,
      simulationId: input.simulationId,
      to: input.to,
      subject: input.subject,
      pdfSizeBytes: Buffer.from(input.pdfBase64, 'base64').byteLength,
    },
    'Envio de email de simulacao executado em modo stub',
  );

  return { success: true };
}

export type SendSimulationWhatsAppInput = {
  tenantId: number;
  simulationId: number;
  phone: string;
  message: string;
  pdfBase64: string;
};

export async function sendViaWhatsApp(_input: SendSimulationWhatsAppInput) {
  throw new Error('WhatsApp adapter desativado nesta fase (previsto para Fase 29).');
}
