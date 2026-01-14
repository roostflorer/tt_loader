# Admin Dashboard Design Guidelines

## Design Approach
**Design System**: Hybrid approach drawing from Linear's modern minimalism, Vercel's clean dashboard patterns, and Tailwind UI's data-focused components. Prioritizing information density, scanability, and professional polish.

## Core Design Elements

### Typography
- **Primary Font**: Inter (Google Fonts)
- **Hierarchy**:
  - Page Titles: 2xl/3xl, semibold (text-2xl font-semibold)
  - Section Headers: lg/xl, medium (text-lg font-medium)
  - Body Text: sm/base, normal (text-sm)
  - Metrics/Numbers: 3xl/4xl, bold for primary stats (text-3xl font-bold)
  - Labels: xs/sm, medium, uppercase for categories (text-xs font-medium uppercase tracking-wide)

### Layout System
**Spacing**: Use Tailwind units of 2, 4, 6, and 8 exclusively (p-4, gap-6, mt-8, etc.)
- Sidebar width: 64 units (w-64)
- Main content: max-w-7xl with px-6 py-8
- Card padding: p-6
- Component gaps: gap-4 for tight groups, gap-6 for sections
- Grid layouts: grid-cols-1 md:grid-cols-2 lg:grid-cols-4 for stats, lg:grid-cols-3 for cards

### Component Library

**Dashboard Structure**:
- Fixed sidebar (w-64) with navigation sections: Dashboard, Users, Subscriptions, Analytics, Settings, System Status
- Top bar with search, notifications bell, user avatar dropdown
- Main content area with responsive grid

**Stats Cards** (4-column grid on desktop):
- Large metric number (text-3xl font-bold)
- Label below (text-sm text-muted)
- Trend indicator with arrow icon and percentage change
- Small sparkline chart (optional visualization)
- Border with subtle shadow (border rounded-lg)

**Data Tables**:
- Sticky header row
- Alternating row treatments for scanability
- Action buttons in rightmost column (icon buttons)
- Pagination controls at bottom
- Sortable columns with arrow indicators
- Row selection checkboxes for bulk actions

**User Management Cards**:
- Avatar + name + email/telegram handle
- Status badge (Active/Suspended/Premium)
- Quick action buttons (Edit, Suspend, Delete)
- Subscription tier indicator
- Usage metrics preview

**Charts & Visualizations**:
- Line chart for downloads over time
- Bar chart for top users by usage
- Donut chart for subscription distribution
- Use subtle grid lines, clear axis labels

**Navigation Sidebar**:
- Logo at top (h-16 with centered content)
- Menu items with icons (Heroicons)
- Active state: filled background (bg-accent)
- Grouped sections with dividers
- Collapse button for mobile

**Dark/Light Mode**:
- Background: bg-white dark:bg-gray-950
- Cards: bg-white dark:bg-gray-900 with border
- Text: text-gray-900 dark:text-gray-100
- Muted text: text-gray-600 dark:text-gray-400
- Borders: border-gray-200 dark:border-gray-800
- Accent elements maintain visibility in both modes

**Form Elements**:
- Search bar in top navigation (w-96 max-w-md)
- Filters: Dropdown selects, date range pickers
- Inline editing for quick updates
- Floating action button for "Add User" (fixed bottom-right on mobile)

### Icons
Use **Heroicons** (outline for sidebar, solid for actions)
- Dashboard: ChartBarIcon
- Users: UsersIcon
- Subscriptions: CreditCardIcon
- Analytics: PresentationChartLineIcon
- Settings: CogIcon
- System: ServerIcon

### Animations
Minimal, functional only:
- Sidebar collapse/expand transition
- Table row hover state
- Chart data point tooltips on hover
- Dropdown menu fade-in

## Images
**No hero images required** - this is a data-focused dashboard. Use:
- User avatars (circular, 40px for list items, 32px for table rows)
- Bot logo in sidebar header (48px square)
- Empty state illustrations for tables with no data (use undraw.co style placeholders, 240px tall)

## Page Sections

**Dashboard Overview**:
1. Top stats row (4 cards): Total Users, Active Subscriptions, Downloads Today, Server Uptime
2. Charts section (2-column): Downloads graph (left, 2/3 width) + Subscription distribution (right, 1/3 width)
3. Recent users table (last 10 users, limited columns)

**Users Page**:
1. Search/filter bar with status dropdown
2. User cards grid (3-column) OR data table toggle
3. Pagination

**Subscriptions Page**:
1. Revenue stats cards
2. Subscription tiers comparison table
3. Recent transactions list

**Analytics**:
1. Date range selector
2. Multi-metric dashboard with 6-8 stat cards
3. Detailed charts section

Professional, scannable, efficient - optimized for admin workflows.