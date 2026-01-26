import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        black: '#000000',
        white: '#ffffff',
        gray: {
          900: '#111111',
          800: '#1a1a1a',
          700: '#333333',
          600: '#555555',
          500: '#777777',
          400: '#999999',
          300: '#cccccc',
          200: '#e5e5e5',
          100: '#f5f5f5',
          50: '#fafafa',
        },
        text: {
          DEFAULT: '#111111',
          secondary: '#555555',
          tertiary: '#777777',
        },
        bg: {
          DEFAULT: '#ffffff',
          secondary: '#fafafa',
        },
        border: '#e5e5e5',
        link: '#0066cc',
      },
      spacing: {
        'section': '120px',
        'container': '24px',
      },
      maxWidth: {
        'DEFAULT': '1200px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 12px rgba(0,0,0,0.06)',
        lg: '0 8px 24px rgba(0,0,0,0.08)',
      },
      transitionDuration: {
        fast: '0.15s',
        base: '0.2s',
        slow: '0.3s',
      },
      zIndex: {
        'header': '1000',
        'modal': '2000',
      }
    },
  },
  plugins: [typography],
}
