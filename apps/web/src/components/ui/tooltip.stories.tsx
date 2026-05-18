import type { Meta, StoryObj } from '@storybook/react';
import { Info, HelpCircle } from 'lucide-react';
import { Tooltip } from './tooltip';
import { Button } from './button';

const meta: Meta<typeof Tooltip> = {
  title: 'UI/Tooltip',
  component: Tooltip,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    side: { control: 'select', options: ['top', 'bottom', 'left', 'right'] },
    delay: { control: { type: 'range', min: 0, max: 1000, step: 50 } },
    disabled: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  args: { content: 'Clique para salvar', side: 'top' },
  render: (args) => (
    <Tooltip {...args}>
      <Button variant="primary">Salvar OS</Button>
    </Tooltip>
  ),
};

export const WithIcon: Story = {
  name: 'Com ícone',
  render: () => (
    <Tooltip content="parseBRL formata valores monetários automaticamente" side="right">
      <button className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors">
        <HelpCircle size={16} />
      </button>
    </Tooltip>
  ),
};

export const AllSides: Story = {
  name: 'Todas as posições',
  render: () => (
    <div className="grid grid-cols-2 gap-8 p-16">
      {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
        <Tooltip key={side} content={`Tooltip ${side}`} side={side} delay={0}>
          <Button variant="secondary" size="sm">{side}</Button>
        </Tooltip>
      ))}
    </div>
  ),
};

export const LongContent: Story = {
  name: 'Conteúdo longo',
  render: () => (
    <Tooltip content="Operações financeiras são sempre atômicas — nunca read-compute-write separado." side="bottom" delay={0}>
      <span className="inline-flex items-center gap-1.5 text-[0.875rem] text-[var(--fg-muted)] cursor-default">
        <Info size={14} />
        Por que isso é seguro?
      </span>
    </Tooltip>
  ),
};
