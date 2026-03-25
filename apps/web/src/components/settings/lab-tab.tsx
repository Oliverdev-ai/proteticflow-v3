import { BrandingForm } from './branding-form';
import { PrinterSettingsForm } from './printer-settings-form';
import { SmtpSettingsForm } from './smtp-settings-form';
import { LabIdentityForm } from './lab-identity-form';
import { LogoUpload } from './logo-upload';

export function LabTab() {
  return (
    <div className="space-y-6">
      <LabIdentityForm />
      <BrandingForm />
      <LogoUpload />
      <div className="border-t border-neutral-800 pt-4 space-y-6">
        <h4 className="text-white font-medium">Infra local</h4>
        <PrinterSettingsForm />
        <SmtpSettingsForm />
      </div>
    </div>
  );
}
