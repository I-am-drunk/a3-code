import type { SVGProps } from "react";

/**
 * Integration/source glyphs. Devin ships these in ServiceLogos-Fi18aFob.js as
 * inline SVGs (aria-hidden, currentColor, `fill-[#222326] dark:fill-white` for GitHub).
 * Lucide v1 removed brand marks, so they are authored here at the same 16px box.
 */
type P = SVGProps<SVGSVGElement> & { size?: number };

export function GitHubIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...p}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.13v3.16c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function GitLabIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...p}>
      <path d="m23.6 9.6-.03-.09-3.27-8.53a.85.85 0 0 0-.34-.4.87.87 0 0 0-1 .05.87.87 0 0 0-.29.44l-2.2 6.75H7.54L5.33 1.07a.86.86 0 0 0-.29-.44.87.87 0 0 0-1-.05.86.86 0 0 0-.34.4L.43 9.5l-.03.09a6.07 6.07 0 0 0 2.01 7.02l.01.01.03.02 4.98 3.73 2.46 1.86 1.5 1.13a1.01 1.01 0 0 0 1.22 0l1.5-1.13 2.46-1.86 5.01-3.75.01-.01a6.07 6.07 0 0 0 2.01-7.01Z" />
    </svg>
  );
}

export function SlackIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path fill="#E01E5A" d="M5.04 15.16a2.52 2.52 0 1 1-2.52-2.52h2.52v2.52Zm1.27 0a2.52 2.52 0 0 1 5.04 0v6.31a2.52 2.52 0 1 1-5.04 0v-6.31Z" />
      <path fill="#36C5F0" d="M8.83 5.04a2.52 2.52 0 1 1 2.52-2.52v2.52H8.83Zm0 1.28a2.52 2.52 0 0 1 0 5.04H2.52a2.52 2.52 0 1 1 0-5.04h6.31Z" />
      <path fill="#2EB67D" d="M18.96 8.84a2.52 2.52 0 1 1 2.52 2.52h-2.52V8.84Zm-1.28 0a2.52 2.52 0 0 1-5.04 0V2.52a2.52 2.52 0 1 1 5.04 0v6.32Z" />
      <path fill="#ECB22E" d="M15.16 18.96a2.52 2.52 0 1 1-2.52 2.52v-2.52h2.52Zm0-1.28a2.52 2.52 0 0 1 0-5.04h6.32a2.52 2.52 0 1 1 0 5.04h-6.32Z" />
    </svg>
  );
}

export function LinearIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" fill="currentColor" {...p}>
      <path d="M1.23 61.3a49.1 49.1 0 0 0 37.5 37.5L1.23 61.3Zm-1.2-14.6 53.3 53.3a49.7 49.7 0 0 0 11.1-2.1L2.14 35.6a49.7 49.7 0 0 0-2.1 11.1Zm5.6-20.4 68.1 68.1a49.9 49.9 0 0 0 8.5-6L11.6 17.8a49.9 49.9 0 0 0-6 8.5Zm11.2-13.4A50 50 0 1 1 87.2 83.2L16.8 12.9Z" />
    </svg>
  );
}

export function JiraIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...p}>
      <path fill="#2684FF" d="M11.53 2 2 11.53a.7.7 0 0 0 0 .99l5.02 5.02a4.5 4.5 0 0 1 0-6.37L11.53 6.6l4.52 4.52a.7.7 0 0 0 1 0L21.5 6.7a.7.7 0 0 0 0-1L16.9 1a.7.7 0 0 0-1 0l-4.37 1Z" opacity=".9" />
      <path fill="#2684FF" d="M12.47 22 22 12.47a.7.7 0 0 0 0-.99l-5.02-5.02a4.5 4.5 0 0 1 0 6.37l-4.51 4.57-4.52-4.52a.7.7 0 0 0-1 0L2.5 17.3a.7.7 0 0 0 0 1L7.1 23a.7.7 0 0 0 1 0l4.37-1Z" />
    </svg>
  );
}

export function PylonIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...p}>
      <path d="M12 2 3 21h4.2l1.5-3.4h6.6L16.8 21H21L12 2Zm-1.9 12.2L12 9.6l1.9 4.6h-3.8Z" />
    </svg>
  );
}

export function IncidentIoIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...p}>
      <path d="M4 4h16v10H4z" opacity=".35" /><path d="M4 16h7v4H4zM13 16h7v4h-7z" />
    </svg>
  );
}

export function SentryIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" {...p}>
      <path d="M13.3 3.1a1.5 1.5 0 0 0-2.6 0L8.5 6.9a12.9 12.9 0 0 1 6.9 10.6h-2.6a10.3 10.3 0 0 0-5.6-8.4L4.6 13.5a6.5 6.5 0 0 1 3.4 4h-2a4.5 4.5 0 0 0-2.2-2.2l-1.3 2.2c-.5.9.1 2 1.2 2h5.8v-.9a8.2 8.2 0 0 0-3.3-6.3l.9-1.6a10.2 10.2 0 0 1 4.3 7.9v.9h6.2v-.9A14.7 14.7 0 0 0 10.8 5.9l1.2-2 8.5 14.7h1.9c1.1 0 1.7-1.1 1.2-2L13.3 3.1Z" />
    </svg>
  );
}

export function DatadogIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className="fill-[#632CA6] dark:fill-[#B794F6]" {...p}>
      <path d="M17.3 15.9 15 14.4l-1.9 3.2-2.2-.6-2 3 5 .4 1.8-2.5.8.6 1.6-1.4-.8-1.2Zm-9.6-5.1 1.8-.3c.3.1.5.2.9.2.6 0 1.1-.1 1.3-.4.4-.6.7-1.8-.1-2.5L10 6.6l.5-.9c1.4.5 2.7.4 3.3-.6.5-.9.3-2.1-.3-2.9.4-.3.9-.5 1.4-.5 1.1 0 1.7.6 2.2 1.4l.1.3 1.4 6.1-.2.1c-.2.4-.4.9-.4 1.3 0 .5.1.8.3 1.1l2.6 2.6.7 3.3-4.1-3.4-.2-.4c-.5-1-1.2-1.6-2.4-1.9-.7-.2-1.9-.2-3 .3l-.3-.2L8 12.1l-.3-1.3Zm-3.4 1.7L5.7 8l.8-.4 2.9-.5 3.2 2.9a3 3 0 0 1-1.8.7c-.4 0-.7 0-1-.1l-2.3.3-.3 2.3 1.7 1.8 2 .2 1.5-1.1c.7-.2 1.3-.2 1.8 0 .7.2 1.1.6 1.4 1.2l.3.6-2.6 4-5.3-.4-1.8-2.8-2.3.2.4-4.3Z" />
    </svg>
  );
}

/** Generic MCP mark used when the catalog has no logo mapping. */
export function McpGenericIcon({ size = 16, ...p }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><circle cx="12" cy="12" r="4.5" />
    </svg>
  );
}
