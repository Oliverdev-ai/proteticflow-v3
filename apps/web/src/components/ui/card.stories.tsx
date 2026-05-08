import type { Meta, StoryObj } from '@storybook/react';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from './card';
import { Button } from './button';
import { Badge } from './badge';

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 360 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <CardTitle>OS-2026-00481</CardTitle>
        <CardDescription>Coroa em e.max · Dr. Marcelo Ferreira</CardDescription>
      </CardHeader>
      <p className="text-[0.875rem] text-[var(--fg-muted)]">Prazo de entrega: 14 mai 2026</p>
    </Card>
  ),
};

export const WithFooter: Story = {
  render: () => (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Faturamento — abril</CardTitle>
          <Badge variant="success" dot>Fechado</Badge>
        </div>
        <CardDescription>Período: 01/04 – 30/04/2026</CardDescription>
      </CardHeader>
      <p className="t-display-sm text-[var(--fg-strong)]">R$ 48.320,00</p>
      <CardFooter className="justify-end gap-2">
        <Button variant="ghost" size="sm">Ver DRE</Button>
        <Button variant="secondary" size="sm">Exportar PDF</Button>
      </CardFooter>
    </Card>
  ),
};

export const NoPadding: Story = {
  render: () => (
    <Card padding="none">
      <div className="p-5 border-b border-[var(--border)]">
        <CardTitle>Trabalhos em produção</CardTitle>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {['OS-481', 'OS-482', 'OS-483'].map((id) => (
          <li key={id} className="px-5 py-3 text-[0.875rem] text-[var(--fg)]">{id}</li>
        ))}
      </ul>
    </Card>
  ),
};
