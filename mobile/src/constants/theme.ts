/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#4A3B42",
    background: "#FDFBF7",
    backgroundElement: "#F9ECEC",
    backgroundSelected: "#E5B4B2",
    textSecondary: "#7D646E",
  },
  dark: {
    text: "#ffffff",
    background: "#1a1025",
    backgroundElement: "#2e1f45",
    backgroundSelected: "#a888ff",
    textSecondary: "#c9b8e0",
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

// Mor-pembe-lacivert marka paleti — özel ekranlarda (dolap, kombin, profil) doğrudan
// import edip kullan: import { Brand } from "@/constants/theme";
export const Brand = {
  background: "#e9d3ff", // Açık mor
  surface: "#f5e6ff", // Çok açık mor
  border: "#a46bf1", // Orta mor

  primary: "#b133ae", // Ana buton, seçili sekme - koyu mor
  primaryDark: "#8b0f8a", // Basılı / aktif durum - daha koyu mor
  primaryLight: "#e9d3ff", // Açık zemin
  secondary: "#ee8dc9", // Alt vurgu - pembe

  textPrimary: "#374271", // Lacivert
  textSecondary: "#5f5a8a", // Açık lacivert
  textOnPrimary: "#ffffff", // Beyaz metin mor arka planda
  textMuted: "#a46bf1", // Sessiz mor ton

  danger: "#e11d48",
  success: "#16a34a",
  favorite: "#ee8dc9", // Favori kalbi için pembe
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
