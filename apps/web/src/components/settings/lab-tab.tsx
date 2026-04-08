import { BrandingForm } from './branding-form';
import { PrinterSettingsForm } from './printer-settings-form';
import { SmtpSettingsForm } from './smtp-settings-form';
import { LabIdentityForm } from './lab-identity-form';
import { LogoUpload } from './logo-upload';
import { Large, Muted } from '../shared/typography';
import { Activity } from 'lucide-react';

export function LabTab() {
  return (
    <div className="flex flex-col gap-10">
      <LabIdentityForm />
      <BrandingForm />
      <LogoUpload />
      
      <div className="flex flex-col gap-8 pt-8 border-t border-border/50">
        <div className="flex items-center gap-4 relative ml-4">
           <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <Activity size={18} strokeWidth={3} />
           </div>
           <div className="flex flex-col gap-0.5">
              <Large className="tracking-tight text-lg font-black uppercase">Infraestrutura Local</Large>
              <Muted className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40">Endpoints técnicos e periféricos da rede</Muted>
           </div>
        </div>
        
        <PrinterSettingsForm />
        <SmtpSettingsForm />
      </div>
    </div>
  );
}
