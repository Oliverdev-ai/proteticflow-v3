import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './badge';

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant: { control: 'select', options: ['default', 'primary', 'success', 'warning', 'destructive', 'info', 'outline'] },
    dot: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Badge>;

export const Default: Story = { args: { children: 'Rascunho' } };
export const Primary: Story = { args: { children: 'EM PRODUÇÃO', variant: 'primary', dot: true } };
export const Success: Story = { args: { children: 'PAGO', variant: 'success', dot: true } };
export const Warning: Story = { args: { children: 'VENCENDO', variant: 'warning', dot: true } };
export const Destructive: Story = { args: { children: 'VENCIDO', variant: 'destructive', dot: true } };
export const Info: Story = { args: { children: 'NOVO', variant: 'info' } };
export const Outline: Story = { args: { children: 'Pendente', variant: 'outline' } };

export const StatusPanel: Story = {
  name: 'Painel de status',
  render: () => (
    <div className="flex flex-wrap gap-2 p-4">
      <Badge variant="default">Pendente</Badge>
      <Badge variant="primary" dot>Em produção</Badge>
      <Badge variant="warning" dot>Controle de qualidade</Badge>
      <Badge variant="success" dot>Pronto</Badge>
      <Badge variant="info">Entregue</Badge>
      <Badge variant="destructive">Cancelado</Badge>
    </div>
  ),
};
