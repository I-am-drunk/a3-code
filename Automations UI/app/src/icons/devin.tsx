import type { SVGProps } from "react";
/** Devin brand mark (`E brand="devin"` in the shipped bundle) — 16px box, currentColor. */
export function DevinMark({ size = 16, ...p }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...p}>
      <path d="M12 2.5 3.5 7.25v9.5L12 21.5l8.5-4.75v-9.5L12 2.5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 7.2 7.8 9.6v4.8l4.2 2.4 4.2-2.4V9.6L12 7.2Z" fill="currentColor" />
    </svg>
  );
}
