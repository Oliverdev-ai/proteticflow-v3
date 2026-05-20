import type { Meta, StoryObj } from '@storybook/react';
import { Hero, HeroSkeleton } from './hero';

const meta: Meta<typeof Hero> = {
  title: 'Layout/Hero',
  component: Hero,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [(Story) => <div style={{ maxWidth: 900 }}><Story /></div>],
  argTypes: {
    name:      { control: 'text',    description: 'Nome completo do usuário' },
    subtitle:  { control: 'text',    description: 'Subtítulo / insight do dia' },
    imageSrc:  { control: 'text',    description: 'URL da imagem decorativa (direita)' },
    imageAlt:  { control: 'text' },
    ctaLabel:  { control: 'text',    description: 'Label do botão CTA' },
  },
};
export default meta;
type Story = StoryObj<typeof Hero>;

export const Default: Story = {
  name: 'Default — só saudação',
  args: {
    name: 'Marcelo Miguel',
  },
};

export const WithSubtitle: Story = {
  name: 'WithSubtitle',
  args: {
    name: 'Marcelo Miguel',
    subtitle: '12 trabalhos em produção · 3 entregas hoje · 1 atrasado',
  },
};

export const WithCta: Story = {
  name: 'WithCta',
  args: {
    name: 'Ana Paula',
    subtitle: 'Nenhuma entrega pendente para hoje. Bom dia tranquilo.',
    ctaLabel: 'Ver roteiro do dia',
    onCtaClick: () => alert('CTA clicado'),
  },
};

export const WithImage: Story = {
  name: 'WithImage',
  args: {
    name: 'Carlos Souza',
    subtitle: '7 entregas confirmadas · receita do dia: R$ 4.200,00',
    ctaLabel: 'Ver financeiro',
    onCtaClick: () => undefined,
    imageSrc: 'https://images.unsplash.com/photo-1581803118522-7b72a50f7e9f?w=600&q=80',
    imageAlt: 'Bancada de laboratório de prótese',
  },
};

export const Skeleton: Story = {
  name: 'Skeleton — carregando',
  render: () => <HeroSkeleton />,
};
