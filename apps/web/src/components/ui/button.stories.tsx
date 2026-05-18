import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    variant:  { control: 'select', options: ['primary', 'secondary', 'ghost', 'destructive', 'outline'] },
    size:     { control: 'select', options: ['sm', 'md', 'lg'] },
    loading:  { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = { args: { children: 'Salvar OS', variant: 'primary' } };
export const Secondary: Story = { args: { children: 'Cancelar', variant: 'secondary' } };
export const Ghost: Story = { args: { children: 'Ver detalhes', variant: 'ghost' } };
export const Destructive: Story = { args: { children: 'Excluir trabalho', variant: 'destructive' } };
export const Outline: Story = { args: { children: 'Exportar PDF', variant: 'outline' } };
export const Loading: Story = { args: { children: 'Salvando…', variant: 'primary', loading: true } };
export const Disabled: Story = { args: { children: 'Indisponível', variant: 'primary', disabled: true } };
export const Small: Story = { args: { children: 'Nova OS', size: 'sm' } };
export const Large: Story = { args: { children: 'Confirmar entrega', size: 'lg' } };

export const AllVariants: Story = {
  name: 'Todas as variantes',
  render: () => (
    <div className="flex flex-wrap gap-3 p-4">
      <Button variant="primary">Primário</Button>
      <Button variant="secondary">Secundário</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="destructive">Destrutivo</Button>
      <Button loading>Carregando</Button>
      <Button disabled>Desabilitado</Button>
    </div>
  ),
};
