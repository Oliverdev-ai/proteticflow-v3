import type { Meta, StoryObj } from '@storybook/react';
import { StatusChip } from './status-chip';

const meta: Meta<typeof StatusChip> = {
  title: 'Shared/StatusChip',
  component: StatusChip,
  tags: ['autodocs'],
  args: {
    label: 'Pendente',
    variant: 'neutral',
  },
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof StatusChip>;

export const Neutral: Story = {
  args: { label: 'Pendente', variant: 'neutral' },
};

export const Info: Story = {
  args: { label: 'Em producao', variant: 'info' },
};

export const Warning: Story = {
  args: { label: 'Qualidade', variant: 'warning' },
};

export const Success: Story = {
  args: { label: 'Pronto', variant: 'success' },
};

export const Accent: Story = {
  args: { label: 'Entregue', variant: 'accent' },
};

export const Primary: Story = {
  args: { label: 'Atencao', variant: 'primary' },
};

export const Destructive: Story = {
  args: { label: 'Cancelado', variant: 'destructive' },
};
