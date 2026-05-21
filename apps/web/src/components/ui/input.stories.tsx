import type { Meta, StoryObj } from '@storybook/react';
import { Search, Mail, Eye } from 'lucide-react';
import { Input } from './input';

const meta: Meta<typeof Input> = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  decorators: [(Story) => <div style={{ width: 320 }}><Story /></div>],
};
export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = { args: { label: 'Nome do cliente', placeholder: 'Ex.: Dr. João Silva' } };
export const WithHint: Story = { args: { label: 'E-mail', placeholder: 'voce@lab.com.br', hint: 'Usado para envio de portal do cliente.' } };
export const WithError: Story = { args: { label: 'CNPJ', placeholder: '00.000.000/0000-00', error: 'CNPJ inválido, confira o número e tente novamente.' } };
export const WithLeadingIcon: Story = { args: { label: 'Buscar', placeholder: 'Buscar OS, clientes…', leadingIcon: <Search size={16} /> } };
export const WithTrailingIcon: Story = { args: { label: 'Senha', type: 'password', placeholder: '••••••••', trailingIcon: <Eye size={16} /> } };
export const Disabled: Story = { args: { label: 'Código da OS', value: 'OS-2026-00481', disabled: true } };
export const EmailField: Story = { args: { label: 'E-mail', type: 'email', placeholder: 'contato@lab.com.br', leadingIcon: <Mail size={16} /> } };
