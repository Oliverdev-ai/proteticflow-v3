import type { Preview } from '@storybook/react';
import '../src/globals.css';

const preview: Preview = {
  parameters: {
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    a11y: { config: { rules: [{ id: 'color-contrast', enabled: true }] } },
    backgrounds: { disable: true },
  },
  globalTypes: {
    theme: {
      name: 'Tema',
      description: 'Tema global da aplicação',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', icon: 'sun', title: 'Light' },
          { value: 'dark', icon: 'moon', title: 'Dark' },
        ],
        showName: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals['theme'] ?? 'light';
      document.documentElement.setAttribute('data-theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.body.style.background = theme === 'dark' ? '#0F1419' : '#FAF7F2';
      return Story();
    },
  ],
};

export default preview;
