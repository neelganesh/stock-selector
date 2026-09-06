# Application Design Specification (Kite-Inspired Minimal UI)

## 1. Overview
This document outlines the design system and layout architecture for a clean, minimal, data-heavy web application. The design prioritizes readability, strict spatial organization, and a high data-to-ink ratio, using subtle borders and ample whitespace instead of heavy shadows or bright backgrounds.

---

## 2. Global Layout Architecture
The application uses a strict 100vh (viewport height) layout, preventing the entire page from scrolling. Instead, specific internal panes scroll independently.

### 2.1 Macro Grid Structure
*   **Top Bar (Header):** Fixed at the top, spanning 100% of the viewport width.
*   **Body Container:** Takes up the remaining vertical space (`calc(100vh - headerHeight)`). Uses a Flexbox or CSS Grid layout to split into two columns:
    *   **Left Pane (Sidebar):** Fixed width, vertically scrollable.
    *   **Main Area:** Fluid width (takes remaining space), vertically scrollable independently of the Left Pane.

---

## 3. Component Breakdown

### 3.1 Top Bar (Header)
*   **Height:** Fixed (typically ~55px - 60px).
*   **Background:** Solid White (`#FFFFFF`).
*   **Border:** A subtle 1px solid light gray bottom border.
*   **Layout (Flexbox):** Space-between alignment.
    *   **Left Side:** Global metrics or branding (e.g., market index tickers). Text should be small, bold, with color-coded numbers (green/red).
    *   **Right Side:** Navigation links. 
*   **Navigation Links:** 
    *   Horizontal list.
    *   States: Inactive links are muted gray; the active link is distinct (e.g., brand color text like orange/red, or underlined).

### 3.2 Left Pane (Sidebar / List View)
*   **Width:** Fixed (e.g., 320px to 380px).
*   **Background:** Very light gray/off-white (e.g., `#FAFAFA`).
*   **Border:** A subtle 1px solid light gray right border separating it from the main area.
*   **Internal Structure:**
    *   **Sticky Search/Filter Header:** A sticky top section containing a full-width search input field with no heavy borders (just a bottom border).
    *   **List Items:** A vertically scrolling list. Each item is a row.
        *   *Row Layout:* Flexbox, space-between. Left side for item name, right side for numerical values.
        *   *Hover State:* Row background slightly darkens on hover to indicate interactivity.
        *   *Dividers:* 1px solid light gray bottom border between list items.

### 3.3 Main Area (Content / Dashboard)
*   **Width:** Fluid (`flex: 1` or `width: calc(100% - sidebarWidth)`).
*   **Background:** Solid White (`#FFFFFF`) or slightly off-white to make cards pop (though in this specific minimal design, flat white is often used everywhere with section dividers).
*   **Padding:** Generous outer padding (e.g., `32px` or `40px` on all sides) for a breathable, uncluttered feel.
*   **Internal Structure (Widget/Card System):**
    *   **Headers:** Large, clean typography for page titles (e.g., "Hi, User").
    *   **Grid Layout:** Content is organized into a CSS Grid (e.g., a 2-column or 3-column grid for metrics, spanning full width for charts/tables).
    *   **Cards/Sections:** 
        *   Avoid heavy drop shadows. Use a 1px solid light gray border or simply rely on whitespace to separate sections.
        *   Large, prominent numbers for primary data points.
        *   Subtle, small text for labels (e.g., "Margin available", "Opening balance").

---

## 4. Theming & Styling Guidelines

### 4.1 Color Palette
*   **Backgrounds:** 
    *   App Background / Main Area: `#FFFFFF`
    *   Sidebar Background: `#FAFAFA`
*   **Text:**
    *   Primary Text (Headings, Main Data): `#333333` or `#444444` (Avoid pure black for softer contrast).
    *   Secondary Text (Labels, Inactive tabs): `#888888` or `#999999`.
*   **Borders & Dividers:**
    *   Standard divider: `#EEEEEE` or `#E0E0E0`.
*   **Semantic Data Colors (Crucial for Dashboards):**
    *   Positive / Gain / Success: `#4CAF50` (A clear, readable green).
    *   Negative / Loss / Error: `#E53935` (A clear, readable red).
    *   Brand Accent: Used sparingly for active states or primary buttons (e.g., the subtle orange/red in the navigation).

### 4.2 Typography
*   **Font Family:** Clean Sans-Serif. Use modern system fonts for performance and native feel (e.g., `Inter`, `Roboto`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`).
*   **Scale:**
    *   *Micro (10-12px):* Badges, subtle labels, percentages.
    *   *Small (13-14px):* Standard list items, navigation links, secondary text.
    *   *Base (15-16px):* Standard paragraph text.
    *   *Headers (20-24px):* Section titles.
    *   *Display (36px+):* Key metrics (e.g., the total holdings value).
*   **Weight:** Use Regular (400) for most text, Medium (500) for labels, and Light (300) for giant display numbers to keep them from looking heavy.

### 4.3 Spacing & Spacing System
Use a strict 4px or 8px baseline grid to ensure consistency.
*   **Micro padding:** 4px or 8px (inside small badges or tight rows).
*   **Standard component padding:** 16px (inside standard cards or list items).
*   **Macro section margin:** 32px or 48px (between distinct widget sections in the main area).

---

## 5. CSS Implementation Skeleton (Conceptual)

```css
/* Base Reset & Variables */
:root {
  --nav-height: 60px;
  --sidebar-width: 350px;
  --border-color: #e0e0e0;
  --bg-main: #ffffff;
  --bg-sidebar: #fafafa;
}

body {
  margin: 0;
  height: 100vh;
  overflow: hidden; /* Prevent body scroll */
  display: flex;
  flex-direction: column;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* Header */
.top-bar {
  height: var(--nav-height);
  border-bottom: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  flex-shrink: 0;
}

/* App Body Layout */
.app-container {
  display: flex;
  height: calc(100vh - var(--nav-height));
}

/* Left Pane */
.left-pane {
  width: var(--sidebar-width);
  border-right: 1px solid var(--border-color);
  background-color: var(--bg-sidebar);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.left-pane-scrollable {
  overflow-y: auto;
  flex: 1;
}

/* Main Content Area */
.main-area {
  flex: 1;
  background-color: var(--bg-main);
  overflow-y: auto;
  padding: 40px;
}