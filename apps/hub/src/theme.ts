import { createTheme, virtualColor, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core';

/*
 * Görsel dil: yumuşatılmış brutalist.
 * - Kirli beyaz kâğıt, kömür rengi mürekkep (saf siyah değil); ince, düşük kontrastlı çizgiler.
 * - Köşeler hafif yuvarlak; gölgeler bulanık değil ama hafif ve kısa kaydırılmış.
 * - Tek vurgu: açık IEEE mavisi (--hub-accent, styles.css). Yalnızca seçili/öne çıkan yerlerde.
 * - Birincil renk kömür: butonlar koyu, yazıları açık; koyu temada tersine döner.
 * - Koyu tema: saf siyah yerine koyu antrasit zemin.
 */

// Birincil renk: mürekkep. Açık temada siyah, koyu temada kâğıt rengi (8. ton butonların zemini).
// "Sanal renk" olarak tanımlanır; böylece buton yazısının rengi her temada ayrı hesaplanır.
const inkDark: MantineColorsTuple = [
  '#141416',
  '#242426',
  '#383733',
  '#504e49',
  '#6a6862',
  '#87857e',
  '#a8a69f',
  '#c8c6c0',
  '#dddbd4',
  '#eceae4',
];

const inkLight: MantineColorsTuple = [
  '#f2f2f0',
  '#e4e3df',
  '#c8c6c0',
  '#a8a69f',
  '#87857e',
  '#6a6862',
  '#504e49',
  '#3d3c38',
  '#2b2b28',
  '#1f1f1d',
];

// Onaylanan durumlar için koyu yeşil.
const signal: MantineColorsTuple = [
  '#e7f4ee',
  '#cbe7d9',
  '#9bd0b7',
  '#67b693',
  '#3e9e75',
  '#238b61',
  '#137c54',
  '#0b6b4b',
  '#075a3f',
  '#044832',
];

// Uygulamada "blue" ile işaretlenmiş bilgi rozetleri parlak mavi yerine mat çelik mavisi görünür.
const blue: MantineColorsTuple = [
  '#eef2f5',
  '#dce4ea',
  '#b9c8d4',
  '#93aabd',
  '#7390a8',
  '#5d7d98',
  '#4e6e8a',
  '#3f5d78',
  '#344f67',
  '#273d51',
];

// Sıcak nötr griler: kirli beyaz zeminle uyumlu ikincil metin ve ince çizgiler.
const gray: MantineColorsTuple = [
  '#f7f6f3',
  '#efeeea',
  '#e4e2dc',
  '#d9d6cf',
  '#bdb9b1',
  '#9c988f',
  '#66625b',
  '#4f4c46',
  '#3a3834',
  '#24231f',
];

// Koyu tema: koyu antrasit yüzeyler.
const dark: MantineColorsTuple = [
  '#dddbd4',
  '#c2bfb8',
  '#9c9990',
  '#74716b',
  '#3a3c40',
  '#2f3134',
  '#232427',
  '#1a1b1d',
  '#151618',
  '#101112',
];

const SANS = '"Archivo Variable", "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Roboto, sans-serif';

export const theme = createTheme({
  primaryColor: 'ink',
  colors: {
    inkLight,
    inkDark,
    ink: virtualColor({ name: 'ink', light: 'inkLight', dark: 'inkDark' }),
    signal,
    blue,
    gray,
    dark,
  },
  primaryShade: { light: 8, dark: 8 },
  autoContrast: true,
  black: '#2b2b28',
  white: '#fdfcf9',
  fontFamily: SANS,
  headings: {
    fontFamily: SANS,
    fontWeight: '800',
    sizes: {
      h1: { fontSize: '3rem', lineHeight: '1.02' },
      h2: { fontSize: '2.25rem', lineHeight: '1.06' },
      h3: { fontSize: '1.625rem', lineHeight: '1.12' },
      h4: { fontSize: '1.25rem', lineHeight: '1.2' },
      h5: { fontSize: '1rem', lineHeight: '1.35' },
      h6: { fontSize: '0.875rem', lineHeight: '1.35' },
    },
  },
  radius: { xs: '4px', sm: '6px', md: '10px', lg: '14px', xl: '20px' },
  defaultRadius: 'sm',
  cursorType: 'pointer',
  respectReducedMotion: true,
  focusRing: 'auto',
  components: {
    Button: { defaultProps: { radius: 'sm' } },
    Card: { defaultProps: { withBorder: true, radius: 'md', padding: 'lg' } },
    Paper: { defaultProps: { radius: 'md' } },
    Modal: { defaultProps: { radius: 'lg', centered: true } },
    TextInput: { defaultProps: { radius: 'sm' } },
    Select: { defaultProps: { radius: 'sm', allowDeselect: false } },
    Badge: { defaultProps: { radius: 'xs', variant: 'light' } },
    Avatar: { defaultProps: { radius: 'sm' } },
    Anchor: { defaultProps: { underline: 'always', c: 'var(--hub-ink)' } },
  },
});

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#f3f1ec',
    '--mantine-color-default-border': '#d8d5cd',
  },
  dark: {
    '--mantine-color-body': '#17181a',
    '--mantine-color-default-border': '#36383c',
  },
});
