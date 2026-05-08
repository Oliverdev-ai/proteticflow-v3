import type { Meta, StoryObj } from '@storybook/react';
import { Edit2, Trash2, Copy, Download, ChevronDown } from 'lucide-react';
import { Dropdown, type DropdownOption } from './dropdown';
import { Button } from './button';

const meta: Meta<typeof Dropdown> = {
  title: 'UI/Dropdown',
  component: Dropdown,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
};
export default meta;
type Story = StoryObj<typeof Dropdown>;

const osActions: DropdownOption[] = [
  { key: 'edit',      label: 'Editar OS',         icon: <Edit2 size={14} /> },
  { key: 'duplicate', label: 'Duplicar',           icon: <Copy size={14} /> },
  { key: 'export',    label: 'Exportar PDF',       icon: <Download size={14} /> },
  { key: 'sep1',      separator: true },
  { key: 'delete',    label: 'Excluir trabalho',   icon: <Trash2 size={14} />, destructive: true },
];

export const Default: Story = {
  render: () => (
    <Dropdown
      trigger={<Button variant="secondary" size="sm">Ações <ChevronDown size={14} /></Button>}
      items={osActions}
      onSelect={(k) => console.log('selected:', k)}
    />
  ),
};

export const AlignEnd: Story = {
  name: 'Alinhado à direita',
  render: () => (
    <div className="flex justify-end w-64">
      <Dropdown
        trigger={<Button variant="ghost" size="sm"><ChevronDown size={14} /></Button>}
        items={osActions}
        align="end"
      />
    </div>
  ),
};

export const WithDisabled: Story = {
  name: 'Com item desabilitado',
  render: () => (
    <Dropdown
      trigger={<Button variant="outline" size="sm">Opções <ChevronDown size={14} /></Button>}
      items={[
        { key: 'edit',   label: 'Editar',         icon: <Edit2 size={14} /> },
        { key: 'export', label: 'Exportar (Pro)', icon: <Download size={14} />, disabled: true },
        { key: 'sep',    separator: true },
        { key: 'delete', label: 'Excluir',        icon: <Trash2 size={14} />, destructive: true },
      ]}
    />
  ),
};
