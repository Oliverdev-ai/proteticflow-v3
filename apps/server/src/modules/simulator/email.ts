import { sendEmail } from '../notifications/email.js';
import { logger } from '../../logger.js';

type SendSimulationEmailInput = {
  tenantId: number;
  simulationId: number;
  to: string;
  subject: string;
  pdfBase64: string;
};

export async function sendSimulationEmail(input: SendSimulationEmailInput) {
  try {
    const result = await sendEmail({
      to: input.to,
      subject: input.subject,
      text: `Segue o orçamento #${input.simulationId} em anexo.`,
    });
    logger.info(
      { action: 'simulator.email.sent', tenantId: input.tenantId, simulationId: input.simulationId, to: input.to, sent: result.sent },
      'Email de simulação enviado',
    );
    return { success: true, sent: result.sent };
  } catch (err) {
    logger.error(
      { action: 'simulator.email.error', tenantId: input.tenantId, simulationId: input.simulationId, to: input.to, err },
      'Falha ao enviar email de simulação',
    );
    return { success: false, sent: false };
  }
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
