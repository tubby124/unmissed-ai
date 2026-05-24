/**
 * Shared spring animation constants for Framer Motion (via `motion/react`).
 *
 * These values have been extracted from the most common patterns found
 * across the codebase so that every component can pull from a single
 * source of truth instead of duplicating inline config.
 */

/**
 * Collection of spring presets keyed by usage context.
 *
 * @example
 * ```tsx
 * <motion.div transition={springs.default} />
 * ```
 */
export const springs = {
  /** Stiff default — the most common spring across the app. */
  default: { type: 'spring' as const, stiffness: 300, damping: 24 },

  /** Tab indicator spring — stiffer for precise underline/indicator movement. */
  tab: { type: 'spring' as const, stiffness: 400, damping: 35 },

  /** Floating orb / PiP spring — bouncy, used by FloatingCallOrb. */
  orb: { type: 'spring' as const, stiffness: 400, damping: 25 },

  /** Status badges — snappy spring for quick pop-in animations. */
  badge: { type: 'spring' as const, stiffness: 420, damping: 18 },

  /** Progress bars — smooth, slow spring for continuous tracking. */
  progress: { type: 'spring' as const, stiffness: 80, damping: 20 },

  /** Drawers / modals — smooth slide spring for panel transitions. */
  drawer: { type: 'spring' as const, stiffness: 300, damping: 25 },

  /** Staggered entries — lightweight spring for each child in a stagger list. */
  stagger: { type: 'spring' as const, stiffness: 500, damping: 25, mass: 0.5 },
} as const

/**
 * Common `initial` / `animate` transition targets.
 *
 * Pass these as the `initial` prop (and leave `animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}`)
 * for a consistent enter animation.
 *
 * @example
 * ```tsx
 * <motion.div initial={transitions.fadeInUp} animate={{ opacity: 1, y: 0 }} />
 * ```
 */
export const transitions = {
  /** Fade in with a slight upward nudge (8 px). */
  fadeIn: { opacity: 0, y: 8 },

  /** Fade in with a moderate upward nudge (16 px). */
  fadeInUp: { opacity: 0, y: 16 },

  /** Fade in with a slight downward nudge (-8 px). */
  fadeInDown: { opacity: 0, y: -8 },

  /** Fade in with a subtle scale-down (0.95). */
  scaleIn: { opacity: 0, scale: 0.95 },

  /** Slide in from the right (20 px offset). */
  slideInRight: { opacity: 0, x: 20 },

  /** Slide in from the left (-20 px offset). */
  slideInLeft: { opacity: 0, x: -20 },
} as const

/**
 * Delay-returning functions for staggered list animations.
 *
 * @example
 * ```tsx
 * {items.map((item, i) => (
 *   <motion.div
 *     key={item.id}
 *     initial={transitions.fadeInUp}
 *     animate={{ opacity: 1, y: 0 }}
 *     transition={{ ...springs.default, ...delays.stagger(i) }}
 *   />
 * ))}
 * ```
 */
export const delays = {
  /** Quick stagger — 40 ms between each child. */
  staggerQuick: (i: number) => ({ delay: i * 0.04 }),

  /** Default stagger — 80 ms between each child. */
  stagger: (i: number) => ({ delay: i * 0.08 }),

  /** Slow stagger — 120 ms between each child. */
  staggerSlow: (i: number) => ({ delay: i * 0.12 }),
}