import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

export const UI = {
  colors: {
    background: '#17141A',
    surface: '#221D25',
    surfaceAlt: '#2D2630',
    border: '#453946',
    primary: '#8D617A',
    primaryDark: '#674456',
    primarySoft: '#382A36',
    accent: '#C4A675',
    textPrimary: '#F0E8DC',
    textSecondary: '#B9ADB7',
    textMuted: '#857A86',
    success: '#879276',
    danger: '#BC717A',
    white: '#FBF7F0',
  },
  radius: { sm: 8, md: 14, lg: 22, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  shadow: {
    card: '0 8px 24px rgba(0, 0, 0, 0.22)',
    raised: '0 12px 28px rgba(0, 0, 0, 0.34)',
  },
  fonts: {
    body:
      Platform.select({
        ios: 'system-ui',
        android: 'sans-serif',
        web: 'var(--font-display)',
        default: 'sans-serif',
      }) ?? 'sans-serif',
    display:
      Platform.select({
        ios: 'ui-serif',
        android: 'serif',
        web: 'var(--font-serif)',
        default: 'serif',
      }) ?? 'serif',
  },
} as const;

export type IconName = ComponentProps<typeof Ionicons>['name'];

export const CATEGORIES = [
  { key: 'Üst', icon: 'shirt-outline' },
  { key: 'Alt', icon: 'layers-outline' },
  { key: 'Elbise', icon: 'body-outline' },
  { key: 'Dış Giyim', icon: 'umbrella-outline' },
  { key: 'Ayakkabı', icon: 'footsteps-outline' },
  { key: 'Aksesuar', icon: 'ellipse-outline' },
  { key: 'Çanta', icon: 'bag-outline' },
  { key: 'Diğer', icon: 'ellipsis-horizontal-circle-outline' },
] as const satisfies readonly { key: string; icon: IconName }[];

export const CATEGORY_HINTS: Record<string, string> = {
  Üst: 'Tişört, bluz, gömlek, kazak, sweatshirt',
  Alt: 'Pantolon, jean, etek, şort, tayt',
  Elbise: 'Günlük elbise, abiye, tulum',
  'Dış Giyim': 'Ceket, mont, kaban, trençkot, hırka',
  Ayakkabı: 'Sneaker, bot, çizme, sandalet, topuklu',
  Aksesuar: 'Şal, atkı, kemer, gözlük, takı, şapka',
  Çanta: 'Omuz çantası, sırt çantası, el çantası',
  Diğer: 'Önerilerden seç ya da kendi kıyafet türünü yaz.',
};

export const OTHER_CATEGORY_SUGGESTIONS = [
  'İç Giyim',
  'Pijama',
  'Mayo',
  'Ev Giyim',
  'Şapka',
  'Çorap',
  'Takı',
  'Şal',
  'Kostüm',
] as const;

export const SEASONS = [
  { key: 'Yaz' },
  { key: 'Kış' },
  { key: 'İlkbahar' },
  { key: 'Sonbahar' },
  { key: 'Tüm Mevsimler' },
] as const;

export function categoryIcon(category: string): IconName {
  return CATEGORIES.find((item) => item.key === category)?.icon ?? 'shirt-outline';
}
