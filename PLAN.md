# Implementation Plan: UI Refinement & End-to-End App Refinement

## Overview
This plan outlines the implementation of UI refinements based on Apple Vision OS design system and end-to-end app refinements as requested by the user.

## Design System Foundation (Phase 1)

### 1. Design Tokens
- Create `src/styles/design-tokens.css` with:
  - Color palette (light theme with glassmorphism support)
  - Spacing scale (4px base)
  - Typography scale
  - Border radius values
  - Shadow definitions
  - Glass effect utilities

### 2. Glassmorphism Utilities
- Create Tailwind utilities for glass effects:
  - `glass-light`: bg-white/10 backdrop-blur-sm
  - `glass-regular`: bg-white/15 backdrop-blur
  - `glass-heavy`: bg-white/25 backdrop-blur-lg
  - Border variants: `glass-border-light`, `glass-border-regular`, `glass-border-heavy`

### 3. Motion System
- Create `src/lib/motion.ts` with:
  - Spring presets: entrance, exit, hover, tap, focus
  - Reduced motion provider respecting `prefers-reduced-motion`
  - Motion variants for common animations

### 4. Base Glass Components
- Enhance `GlassCard.tsx` to accept glass variant props
- Create glass variants for: Card, Modal, Button, Input, Badge
- Ensure all glass components respect reduced motion settings

## Settings Page Refinement (Phase 2)

### 1. Token Visibility
- Modify `SettingsPage.tsx` to implement reveal-on-click:
  - Button to reveal full key (one-time)
  - Auto-re-mask after 30 seconds or on blur
  - Copy to clipboard functionality
  - Security audit to ensure key never persists in URL or logs

### 2. Zerodha Publish Flow
- Replace inline publish button with dedicated modal:
  - `PublishConfirmationModal.tsx`
  - Shows strategy preview and stock basket
  - Explains what publishing does
  - Confirmation required before API call
  - Loading states and success/error handling

### 3. Layout Improvements
- Implement `AppShell` component with responsive slots:
  - Desktop: persistent left rail (Sidebar)
  - Mobile: bottom tab bar (MobileViewTabs)
  - Secondary actions: sheet/drawer (MobileSidebarDrawer)
- Ensure consistent navigation state across breakpoints

## End-to-End Refinement (Phase 3)

### 1. Data Freshness Indicators
- Add global freshness banner:
  - "Data refreshed X time ago" with manual refresh
  - Color coding: green (<5m), amber (5-30m), red (>30m)
- Add per-card freshness dots:
  - ● green/amber/red in card corners
  - Tooltip with exact timestamp on hover

### 2. Animation Refinement
- Apply motion system to:
  - Page transitions (framer-motion AnimatePresence)
  - Component entrances/exits
  - Hover states on interactive elements
  - Loading skeletons with pulse animation
- Ensure all animations respect reduced motion settings

### 3. Responsive Breakpoints
- Update `tailwind.config.js`:
  ```javascript
  screens: {
    compact: '600px',
    regular: '900px',
    expanded: '1200px'
  }
  ```
- Refactor components to use semantic breakpoint names
- Test layouts at compact, regular, and expanded breakpoints

## Testing Strategy

### Unit Tests
- Update existing tests to reflect changes
- Add tests for new glass utility classes
- Test motion configurations
- Test token reveal/hide logic
- Test publish modal validation
- Test responsive behavior with different breakpoint mocks

### Integration Tests
- Test Settings page end-to-end flow:
  - Token masking/revealing
  - Publish modal interaction
  - Navigation between settings sections
- Test data freshness indicators update correctly

### Visual Regression
- Use Storybook for component visual testing
- Ensure glass effects render correctly in light/dark modes
- Verify motion preferences are respected

### Manual Testing Checklist
- [ ] Verify all 261 existing tests still pass
- [ ] Verify build completes without errors
- [ ] Test on mobile, tablet, and desktop breakpoints
- [ ] Verify reduced motion preference works
- [ ] Test token security (no exposure in devtools/network)
- [ ] Test publish flow with mock API
- [ ] Verify data freshness updates with mock data
- [ ] Check accessibility compliance (WCAG AA)
- [ ] Verify glass performance (no excessive repaints)

## Implementation Order

1. **Foundation First** (critical for consistency):
   - Design tokens
   - Glass utilities
   - Motion system
   - Base glass components

2. **Settings Page** (user-reported issues):
   - Token visibility fix
   - Publish modal
   - AppShell navigation

3. **End-to-End Polish**:
   - Data freshness indicators
   - Animation refinements
   - Responsive breakpoint adjustments
   - Final testing and QA

## Status Tracking
- [ ] Phase 1: Design System Foundation
- [ ] Phase 2: Settings Page Refinement
- [ ] Phase 3: End-to-End Refinement
- [ ] Testing: Unit + Integration + Manual
- [ ] Documentation: Update README if needed
- [ ] Final Verification: All tests pass, build succeeds

## Safety Nets
- Each phase includes automated tests
- Changes are component-scoped where possible
- Easy rollback via git if issues arise
- Regular checkpoints to verify existing functionality