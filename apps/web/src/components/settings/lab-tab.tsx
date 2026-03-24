import { BrandingForm } from './branding-form';
import { LabIdentityForm } from './lab-identity-form';
import { LogoUpload } from './logo-upload';

export function LabTab() {
  return (
    <div className="space-y-6">
      <LabIdentityForm />
      <BrandingForm />
      <LogoUpload />
    </div>
  );
}
