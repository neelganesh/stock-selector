import { useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { MobileViewTabs } from './MobileViewTabs';
import { MobileSidebarDrawer } from './MobileSidebarDrawer';
import { usePathname } from 'react-router-dom';

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * AppShell provides the responsive layout structure:
 * - Desktop: persistent left rail (Sidebar) + main content
 * - Mobile: bottom tab bar (MobileViewTabs) + main content
 * - Secondary actions: sheet/drawer (MobileSidebarDrawer) via portal
 */
export function AppShell({ children, className }: AppShellProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile breakpoint based on our design system
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 900); // 'regular' breakpoint (semantic)
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Determine if we should show the sidebar (desktop) or tabs (mobile)
  const showSidebar = !isMobile && pathname !== '/auth'; // Hide sidebar on auth pages
  const showTabs = isMobile && pathname !== '/auth'; // Hide tabs on auth pages

  return (
    <div className={`flex min-h-screen flex-col ${className}`}>
      {/* Always render the main content area */}
      <main className="flex-1 overflow-hidden">
        {/* Desktop layout: Sidebar + Main Content */}
        {!isMobile && showSidebar && (
          <div className="flex h-full">
            <Sidebar className="flex-shrink-0 border-r border-border-default" />
            <div className="flex-1 overflow-y-auto">{children}</div>
          </div>
        )}

        {/* Mobile layout: Main Content + Tabs */}
        {isMobile && (
          <>
            <div className="flex-1 overflow-y-auto">{children}</div>
            {showTabs && <MobileViewTabs className="border-t border-border-default" />}
          </>
        )}

        {/* Auth pages: Full-width content without sidebar/tabs */}
        {!showSidebar && !showTabs && (
          <div className="flex-1 overflow-y-auto">{children}</div>
        )}
      </main>

      {/* Mobile Sidebar Drawer (appears from left on mobile) */}
      {isMobile && (
        <MobileSidebarDrawer
          className="fixed left-0 top-[var(--topbar-h)] h-[calc(100vh-var(--topbar-h))] w-[220px] border-r border-border-default"
        />
      )}
    </div>
  );
}