import { useEffect } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

/**
 * Mounts an invisible component that toggles `is-mobile` on <body>
 * when the viewport is mobile. Use this in conjunction with the
 * `body.is-mobile` CSS rules to make all modals full-screen on mobile.
 */
export function MobileBodyClass(): null {
  const { isMobile } = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      document.body.classList.add('is-mobile');
    } else {
      document.body.classList.remove('is-mobile');
    }
    return () => {
      document.body.classList.remove('is-mobile');
    };
  }, [isMobile]);

  return null;
}
