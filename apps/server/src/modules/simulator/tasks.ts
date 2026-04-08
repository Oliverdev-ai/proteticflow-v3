import { runWithRetry } from '../../core/jobs.js';
import { sendSimulationEmail } from './email.js';

export type SimulationEmailDispatchPayload = {
  tenantId: number;
  simulationId: number;
  to: string;
  subject: string;
  pdfBase64: string;
};

export async function simulationEmailDispatch(payload: SimulationEmailDispatchPayload) {
  return runWithRetry(
    () => sendSimulationEmail(payload),
    2,
    400,
  );
}
