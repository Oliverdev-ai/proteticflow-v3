import { PrinterSettingsForm } from './printer-settings-form';
import { SmtpSettingsForm } from './smtp-settings-form';

export function InfraTab() {
  return (
    <div className="space-y-6">
      <PrinterSettingsForm />
      <SmtpSettingsForm />
    </div>
  );
}
