import { createTheme, type MantineColorsTuple } from '@mantine/core';

// IEEE mavisi (#00629B) etrafında üretilmiş ton skalası.
const ieee: MantineColorsTuple = [
  '#e5f4ff',
  '#cde4fb',
  '#9cc7f2',
  '#67a8ea',
  '#3d8ee3',
  '#237ddf',
  '#1174de',
  '#0063c6',
  '#0058b2',
  '#004b9e',
];

export const theme = createTheme({
  primaryColor: 'ieee',
  colors: { ieee },
  primaryShade: { light: 8, dark: 5 },
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  headings: { fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif', fontWeight: '650' },
  defaultRadius: 'md',
  cursorType: 'pointer',
  components: {
    Button: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { withBorder: true, radius: 'lg', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'lg' } },
    Modal: { defaultProps: { radius: 'lg', centered: true } },
    TextInput: { defaultProps: { radius: 'md' } },
    Select: { defaultProps: { radius: 'md', allowDeselect: false } },
    Badge: { defaultProps: { radius: 'sm', variant: 'light' } },
  },
});
