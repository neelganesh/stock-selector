// Minimal test setup — no jest-dom to avoid esbuild scanning parent dirs

import { vi } from 'vitest';

// ---------------------------------------------------------------------------
// Shim React.act — @testing-library/react@16.x calls React.act which doesn't
// exist in React 19's react package. The react-dom/test-utils production build
// calls React.act, which is undefined. We mock 'react' to add act from
// react-dom/test-utils.  This must be loaded before any other imports.
// ---------------------------------------------------------------------------
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>();
  const { act } = await import('react-dom/test-utils');
  return { ...actual, act };
});

// ---------------------------------------------------------------------------
// Mock framer-motion globally — it has React 19 / jsdom compatibility issues
// with motion.span/animate causing "React.act is not a function" errors.
// ---------------------------------------------------------------------------
// motion.* must return REAL React elements (via React.createElement) so that
// components can render them as children without "Objects are not valid as
// React child" errors.
//
// NOTE: vi.mock hoisting moves vi.mock calls to the top of the file scope,
// but it does NOT hoist imports inside the factory. So import() inside the
// factory executes normally and can access the real react module at runtime.
// ---------------------------------------------------------------------------
vi.mock('framer-motion', async () => {
  const { createElement } = await import('react');

  const MOTION_TAGS = [
    'span', 'div', 'button', 'li', 'ul', 'p', 'form', 'input', 'label',
    'a', 'section', 'header', 'footer', 'nav', 'main', 'aside', 'article',
    'h1', 'h2', 'h3', 'h4', 'img', 'svg', 'circle', 'path', 'rect',
    'line', 'ellipse', 'polygon', 'polyline',
  ];
  const MOTION_PROPS = new Set([
    'animate', 'initial', 'exit', 'transition', 'variants', 'whileHover', 'whileTap',
    'whileFocus', 'whileDrag', 'layout', 'layoutId', 'layoutAnimation',
    'drag', 'dragControls', 'dragListener', 'dragConstraints', 'dragElastic',
    'dragMomentum', 'dragOriginX', 'dragOriginY', 'dragPropagation',
    'custom', 'inherit', 'onAnimationStart', 'onAnimationComplete',
    'onBeforeLayoutMeasure', 'onLayoutMeasure', 'onLayoutAnimationStart',
    'onLayoutAnimationComplete', 'onMotionValueChange', 'onViewportBoxChange',
    'onDragStart', 'onDrag', 'onDragEnd', 'onDragTransitionEnd',
    'viewport', 'whileInView', 'onViewportEnter', 'onViewportLeave',
  ]);

  function stripMotionProps(props: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(props)) {
      if (!MOTION_PROPS.has(k)) out[k] = props[k];
    }
    return out;
  }

  const motion = Object.fromEntries(
    MOTION_TAGS.map((tag) => [
      tag,
      ({ children, ...props }: { children?: unknown; [k: string]: unknown }) => {
        const domProps = stripMotionProps(props);
        return children !== undefined
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ? createElement(tag, domProps as any, children as any)
          : createElement(tag, domProps as any);
      },
    ]),
  );

  return {
    motion,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    useAnimation: () => ({ start: vi.fn() }),
    useInView: () => false,
    useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
    useTransform: () => ({ on: vi.fn(), get: () => 0 }),
    useSpring: (_value: unknown) => ({ set: vi.fn() }),
    motionValue: () => ({ get: () => 0, set: vi.fn() }),
    useReducedMotion: () => false,
    MOTION_TAGS,
  };
});

// ---------------------------------------------------------------------------
// Only run browser-specific setup when window is available (jsdom).
// API tests in api/__tests__ run in Node environment and don't have window.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
