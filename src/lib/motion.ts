import { Variants } from 'framer-motion';

// Spring configurations based on Apple Vision OS principles
export const springConfig = {
  // Gentle, natural springs for entrances and exits
  gentle: { stiffness: 120, damping: 20 },
  // Default spring for most interactions
  default: { stiffness: 150, damping: 20 },
  // Responsive spring for taps and hovers
  responsive: { stiffness: 180, damping: 16 },
  // Quick spring for immediate feedback
  quick: { stiffness: 200, damping: 16 },
};

export const motionVariants = {
  // Entrance animations
  entrance: {
    initial: { opacity: 0, y: 16 },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        type: 'spring',
        stiffness: springConfig.gentle.stiffness,
        damping: springConfig.gentle.damping
      }
    },
    exit: {
      opacity: 0,
      y: -8,
      transition: {
        type: 'spring',
        stiffness: springConfig.default.stiffness,
        damping: springConfig.default.damping
      }
    }
  },

  // Scale entrance (for cards, modals)
  scaleEntrance: {
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: 1,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: springConfig.gentle.stiffness,
        damping: springConfig.gentle.damping
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: {
        type: 'spring',
        stiffness: springConfig.default.stiffness,
        damping: springConfig.default.damping
      }
    }
  },

  // Hover animations
  hover: {
    initial: { scale: 1 },
    whileTap: { scale: 0.97 },
    whileHover: { scale: 1.02 },
    transition: {
      type: 'spring',
      stiffness: springConfig.responsive.stiffness,
      damping: springConfig.responsive.damping
    }
  },

  // Tap animations
  tap: {
    initial: { scale: 1 },
    whileTap: { scale: 0.95 },
    transition: {
      type: 'spring',
      stiffness: springConfig.quick.stiffness,
      damping: springConfig.quick.damping
    }
  },

  // Focus animations
  focus: {
    initial: { boxShadow: '0 0 0 0 rgba(26, 115, 232, 0)' },
    animate: {
      boxShadow: '0 0 0 3px rgba(26, 115, 232, 0.4)'
    },
    transition: { type: 'spring', stiffness: 150, damping: 20 }
  },

  // Pulse animation for loading indicators
  pulse: {
    initial: { opacity: 0.6 },
    animate: [
      { opacity: 1 },
      { opacity: 0.6 }
    ],
    transition: {
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  // Float animation for subtle movement
  float: {
    initial: { y: 0 },
    animate: [
      { y: -4 },
      { y: 0 }
    ],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut'
    }
  },

  // Staggered entrance for lists
  staggered: {
    initial: { opacity: 0, y: 12 },
    animate: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.05,
        type: 'spring',
        stiffness: springConfig.gentle.stiffness,
        damping: springConfig.gentle.damping
      }
    })
  },

  // Modal overlay
  overlay: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: 0.2 }
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.2 }
    }
  },

  // Modal content
  modalContent: {
    initial: { opacity: 0, y: 24, scale: 0.96 },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        type: 'spring',
        stiffness: springConfig.gentle.stiffness,
        damping: springConfig.gentle.damping
      }
    },
    exit: {
      opacity: 0,
      y: 12,
      scale: 0.94,
      transition: {
        type: 'spring',
        stiffness: springConfig.default.stiffness,
        damping: springConfig.default.damping
      }
    }
  }
};

// Reduced motion helper
export const prefersReducedMotion = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// Motion presets that respect reduced motion
export const motionPresets = {
  // If user prefers reduced motion, use instant transitions
  entrance: prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : motionVariants.entrance,

  scaleEntrance: prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : motionVariants.scaleEntrance,

  hover: prefersReducedMotion
    ? {} // No hover effects when reduced motion is preferred
    : motionVariants.hover,

  tap: prefersReducedMotion
    ? {} // No tap effects when reduced motion is preferred
    : motionVariants.tap,

  focus: prefersReducedMotion
    ? { initial: {}, animate: {} } // No focus effects
    : motionVariants.focus,

  pulse: prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 } } // Static
    : motionVariants.pulse,

  float: prefersReducedMotion
    ? { initial: { y: 0 }, animate: { y: 0 } } // Static
    : motionVariants.float,

  staggered: (i: number) => prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 12 },
        animate: {
          opacity: 1,
          y: 0,
          transition: {
            delay: i * 0.05,
            type: 'spring',
            stiffness: springConfig.gentle.stiffness,
            damping: springConfig.gentle.damping
          }
        }
      }
};

// Motion container for shared layout animations
export const layoutAnimation = {
  type: 'spring',
  stiffness: springConfig.gentle.stiffness,
  damping: springConfig.gentle.damping,
  duration: 0.4
};

// Page transition variants
export const pageTransition = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      duration: 0.3,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: 'easeIn'
    }
  }
};