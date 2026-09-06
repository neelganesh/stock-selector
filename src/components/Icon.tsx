import type { ReactNode, SVGProps } from 'react';

/**
 * Single, consistent high-resolution icon set.
 *
 * Every glyph is authored on a 24×24 grid, stroke = 2, round caps/joins,
 * drawn from one family (Heroicons/Lucide-class geometry) so the icon
 * language reads as one system at any size. Icons inherit `currentColor`
 * and scale via the `size` prop (px) or CSS font-size when `size` is
 * omitted. No emoji, no Unicode glyph substitutes.
 */
export type IconName =
  | 'bolt' | 'bars' | 'clipboard' | 'trend' | 'gear'
  | 'wallet' | 'note' | 'plug' | 'globe' | 'palette' | 'bell'
  | 'monitor' | 'sun' | 'moon' | 'refresh' | 'search' | 'arrow-right'
  | 'arrow-up' | 'arrow-down' | 'check' | 'x' | 'chevron-down'
  | 'alert' | 'target' | 'stop' | 'logout' | 'clock' | 'trash'
  | 'import' | 'info' | 'filter' | 'layers' | 'link' | 'user'
  | 'eye' | 'eye-off' | 'lock';

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  /** Pixel size. Omit to inherit font-size (1em). */
  size?: number | string;
}

const paths: Record<IconName, ReactNode> = {
  bolt: <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" />,

  bars: (
    <>
      <path d="M4 20V10M12 20V4M20 20v-7" />
      <path d="M2 20h20" />
    </>
  ),

  clipboard: (
    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  ),

  trend: (
    <>
      <path d="M3 17l6-6 4 4 7-7" />
      <path d="M14 8h6v6" />
    </>
  ),

  gear: (
    <>
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </>
  ),

  wallet: (
    <>
      <path d="M19 7V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2v-2" />
      <path d="M3 5v14a2 2 0 002 2h14a2 2 0 002-2v-4" />
      <path d="M18 12a2 2 0 000 4h4v-4h-4z" />
    </>
  ),

  note: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </>
  ),

  plug: (
    <>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 01-4 4h-4a4 4 0 01-4-4V8Z" />
    </>
  ),

  link: (
    <>
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
    </>
  ),

  globe: (
    <>
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </>
  ),

  palette: (
    <>
      <path d="M12 22a10 10 0 110-20 10 10 0 019 9 5 5 0 01-5 5h-2.25a1.75 1.75 0 00-1.4 2.8l.3.4a1.75 1.75 0 01-1.4 2.8z" />
      <path d="M13.5 6.5h.01M17.5 10h.01M8.5 7.5h.01M6.5 12h.01" />
    </>
  ),

  bell: (
    <>
      <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),

  monitor: (
    <>
      <path d="M2 3h20v13H2z" />
      <path d="M8 21h8M12 16v5" />
    </>
  ),

  sun: (
    <>
      <path d="M12 17a5 5 0 100-10 5 5 0 000 10z" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </>
  ),

  moon: <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />,

  refresh: (
    <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  ),

  search: <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />,

  'arrow-right': <path d="M5 12h14M12 5l7 7-7 7" />,

  'arrow-up': <path d="M12 19V5M5 12l7-7 7 7" />,

  'arrow-down': <path d="M12 5v14M19 12l-7 7-7-7" />,

  check: <path d="M20 6L9 17l-5-5" />,

  x: <path d="M18 6L6 18M6 6l12 12" />,

  'chevron-down': <path d="M6 9l6 6 6-6" />,

  alert: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),

  target: (
    <>
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
      <path d="M12 18a6 6 0 100-12 6 6 0 000 12z" />
      <path d="M12 14a2 2 0 100-4 2 2 0 000 4z" />
    </>
  ),

  stop: (
    <>
      <path d="M7.86 2h8.28L22 7.86v8.28L16.14 22H7.86L2 16.14V7.86z" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </>
  ),

  logout: (
    <>
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </>
  ),

  clock: (
    <>
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
      <path d="M12 6v6l4 2" />
    </>
  ),

  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </>
  ),

  import: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),

  info: (
    <>
      <path d="M12 22a10 10 0 100-20 10 10 0 000 20z" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),

  filter: <path d="M4 6h16M7 12h10M10 18h4" />,

  layers: (
    <>
      <path d="M12 2l10 5-10 5L2 7l10-5z" />
      <path d="M2 12l10 5 10-5M2 17l10 5 10-5" />
    </>
  ),

  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),

  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),

  'eye-off': (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),

  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </>
  ),
};

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
