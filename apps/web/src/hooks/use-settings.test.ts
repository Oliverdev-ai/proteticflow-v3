import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/trpc', () => ({
  trpc: {
    useUtils: () => ({ settings: { getSettingsOverview: { invalidate: vi.fn() } }, auth: { getProfile: { invalidate: vi.fn() } } }),
    settings: {
      getSettingsOverview: { useQuery: () => ({}) },
      updateLabIdentity: { useMutation: () => ({}) },
      updateLabBranding: { useMutation: () => ({}) },
      uploadLogo: { useMutation: () => ({}) },
      removeLogo: { useMutation: () => ({}) },
      updatePrinterSettings: { useMutation: () => ({}) },
      updateSmtpSettings: { useMutation: () => ({}) },
      testSmtpConnection: { useMutation: () => ({}) },
      updateUserRoleFromSettings: { useMutation: () => ({}) },
    },
  },
}));

import { useSettings } from './use-settings';

describe('use-settings', () => {
  it('instancia hook (smoke)', () => {
    expect(typeof useSettings).toBe('function');
  });
});
