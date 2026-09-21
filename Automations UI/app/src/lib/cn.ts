import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * tailwind-merge must learn Devin's custom scales, otherwise it treats
 * `text-13` (font-size) and `text-text-primary-inverse` (color) as the same
 * group and drops one of them.
 */
const TEXT_SIZES = ["10", "11", "12", "13", "14", "15", "16", "17", "18", "22"];
const TEXT_COLORS = [
  "primary", "primary-strong", "primary-inverse", "secondary", "tertiary", "disabled", "accent-primary", "always-white", "always-black",
  "link", "link-strong", "destructive", "red", "green", "orange", "blue", "purple", "brown",
];
const BG_TOKENS = [
  "page", "wash", "elevated", "elevated-wax", "elevated-transparent", "accent-primary", "accent-secondary", "accent-neutral", "destructive", "scrim",
  "blue", "red", "green", "orange", "link",
];
const TINT_TOKENS = ["primary", "secondary", "tertiary", "blue", "red", "green", "orange", "purple", "accent-secondary"];
const BORDER_TOKENS = ["primary", "secondary", "primary-strong", "accent-primary", "primary-always-black", "secondary-always-black"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: TEXT_SIZES }],
      "text-color": [{ text: [...TEXT_COLORS.map((c) => `text-${c}`), ...TEXT_COLORS.map((c) => `text-${c}/[0-9]+`)] }],
      "bg-color": [{ bg: [...BG_TOKENS.map((c) => `bg-${c}`), ...TINT_TOKENS.map((c) => `tint-${c}`), ...TEXT_COLORS.map((c) => `text-${c}`)] }],
      "border-color": [{ border: BORDER_TOKENS.map((c) => `border-${c}`) }],
      "ring-color": [{ ring: [...BORDER_TOKENS.map((c) => `border-${c}`), ...TEXT_COLORS.map((c) => `text-${c}`)] }],
      shadow: [{ shadow: ["L1", "L2", "L3", "L4", "shadow-sm"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
