import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton, SkeletonCard } from './skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Text: Story = { args: { variant: 'text', width: '80%' } };
export const MultiLine: Story = { args: { variant: 'text', lines: 4 } };
export const Rectangle: Story = { args: { variant: 'rect', height: 120 } };
export const Circle: Story = { args: { variant: 'circle', width: 48, height: 48 } };
export const AvatarShape: Story = { args: { variant: 'avatar', width: 36, height: 36 } };

export const CardLoading: Story = {
  name: 'Card em carregamento',
  render: () => <SkeletonCard />,
};

export const DashboardLoading: Story = {
  name: 'Dashboard em carregamento',
  render: () => (
    <div className="flex flex-col gap-4 p-4 w-full">
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-4 flex flex-col gap-3">
            <Skeleton variant="text" width="50%" />
            <Skeleton variant="text" height={32} width="70%" />
            <Skeleton variant="text" width="40%" />
          </div>
        ))}
      </div>
      <div className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] p-5">
        <Skeleton variant="text" width="30%" className="mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-[var(--border)] last:border-0">
            <Skeleton variant="avatar" width={28} height={28} />
            <Skeleton variant="text" width="40%" />
            <div className="ml-auto"><Skeleton variant="text" width={60} /></div>
          </div>
        ))}
      </div>
    </div>
  ),
};
