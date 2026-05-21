import type { Meta, StoryObj } from '@storybook/react';
import { Avatar } from './avatar';

const meta: Meta<typeof Avatar> = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  argTypes: {
    size: { control: 'select', options: ['xs', 'sm', 'md', 'lg', 'xl'] },
    online: { control: 'boolean' },
  },
};
export default meta;
type Story = StoryObj<typeof Avatar>;

export const WithInitials: Story = { args: { name: 'Marcelo Silva', size: 'md' } };
export const Online: Story = { args: { name: 'João Protético', size: 'md', online: true } };
export const Offline: Story = { args: { name: 'Ana Recepcao', size: 'md', online: false } };
export const ExtraSmall: Story = { args: { name: 'OS', size: 'xs' } };
export const Large: Story = { args: { name: 'Dono Lab', size: 'lg', online: true } };
export const ExtraLarge: Story = { args: { name: 'ProteticFlow', size: 'xl' } };

export const Sizes: Story = {
  name: 'Todas as tamanhos',
  render: () => (
    <div className="flex items-center gap-4 p-4">
      <Avatar name="Marcelo Silva" size="xs" />
      <Avatar name="Marcelo Silva" size="sm" />
      <Avatar name="Marcelo Silva" size="md" />
      <Avatar name="Marcelo Silva" size="lg" online />
      <Avatar name="Marcelo Silva" size="xl" />
    </div>
  ),
};
