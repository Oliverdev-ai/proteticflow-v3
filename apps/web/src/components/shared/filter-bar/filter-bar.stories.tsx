import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from '../../ui/button';
import { FilterBar } from './filter-bar';

const meta: Meta<typeof FilterBar> = {
  title: 'Shared/FilterBar',
  component: FilterBar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof FilterBar>;

export const Default: Story = {
  render: () => {
    const [search, setSearch] = useState('');

    return (
      <FilterBar
        search={search}
        onSearchChange={setSearch}
        filters={<span className="t-micro text-muted-foreground">Status: Todos</span>}
        actions={<Button size="sm">Nova OS</Button>}
      />
    );
  },
};
