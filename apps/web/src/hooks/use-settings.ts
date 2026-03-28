import { trpc } from '../lib/trpc';

function createUseSettingsData() {
  const utils = trpc.useUtils();

  const overview = trpc.settings.getSettingsOverview.useQuery({ includeUsers: true });

  const invalidateOverview = async () => {
    await utils.settings.getSettingsOverview.invalidate();
    await utils.auth.getProfile.invalidate();
  };

  const updateIdentity = trpc.settings.updateLabIdentity.useMutation({ onSuccess: invalidateOverview });
  const updateBranding = trpc.settings.updateLabBranding.useMutation({ onSuccess: invalidateOverview });
  const uploadLogo = trpc.settings.uploadLogo.useMutation({ onSuccess: invalidateOverview });
  const removeLogo = trpc.settings.removeLogo.useMutation({ onSuccess: invalidateOverview });
  const updatePrinter = trpc.settings.updatePrinterSettings.useMutation({ onSuccess: invalidateOverview });
  const updateSmtp = trpc.settings.updateSmtpSettings.useMutation({ onSuccess: invalidateOverview });
  const testSmtp = trpc.settings.testSmtpConnection.useMutation({ onSuccess: invalidateOverview });
  const updateRole = trpc.settings.updateUserRoleFromSettings.useMutation({ onSuccess: invalidateOverview });

  return {
    overview,
    updateIdentity,
    updateBranding,
    uploadLogo,
    removeLogo,
    updatePrinter,
    updateSmtp,
    testSmtp,
    updateRole,
  };
}

export function useSettings() {
  return createUseSettingsData();
}
