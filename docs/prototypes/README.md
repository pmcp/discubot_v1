# Discubot Admin UI Prototypes

Beautiful, interactive UI prototypes for Phase 5: Admin UI built with Nuxt UI v4 patterns and Vue 3.

## 🎨 What's Inside

This collection contains 5 standalone HTML prototypes that demonstrate the complete admin interface for Discubot:

### 1. **index.html** - Main Dashboard
The central hub of the admin interface.

**Features:**
- Full dashboard layout with sidebar navigation
- 4 live stat cards (Total Syncs, Active Jobs, Success Rate, Pending Actions)
- Recent activity timeline with Figma/Slack events
- Quick actions panel for common tasks
- System health metrics with progress bars
- Smooth hover states and micro-interactions
- Dark mode toggle

**Highlights:**
- Pulsing indicators for live jobs
- Animated progress bars
- Activity items with hover effects
- Beautiful gradient cards

---

### 2. **config-form.html** - Source Configuration
Configure Figma and Slack integrations.

**Features:**
- Tabbed interface (Figma / Slack)
- Form validation with real-time feedback
- Test connection button with loading states
- Collapsible advanced settings section
- OAuth flow simulation for Slack
- Copy-to-clipboard for webhook URLs
- Success/error alerts with animations

**Highlights:**
- Live field validation
- Smooth tab transitions
- Advanced settings toggle
- Test result feedback

---

### 3. **job-monitor.html** - Job Monitoring Dashboard
Track and manage all sync jobs.

**Features:**
- Advanced data table with 47 mock jobs
- Sortable columns (Job ID, Source, Status, Duration, etc.)
- Filter by status (Running, Complete, Failed, Pending)
- Search and source filtering
- Live progress bars for running jobs
- Row actions dropdown (View, Retry, Cancel, Download Logs)
- Bulk actions (Retry Selected, Delete Selected)
- Pagination with smart page navigation
- Checkbox selection

**Highlights:**
- Pulsing indicators for active jobs
- Smooth row hover effects
- Dropdown menus
- Empty state handling

---

### 4. **job-details.html** - Job Details Modal
Deep dive into individual job execution.

**Features:**
- Beautiful modal with smooth animations
- Tabbed interface: Overview, Logs, Metrics, Actions
- **Overview Tab:**
  - Job info grid (ID, source, duration, items processed)
  - Live progress bar for running jobs
  - Execution timeline with status indicators
  - Discussion details with Notion link
- **Logs Tab:**
  - Syntax-highlighted log viewer
  - Color-coded log levels (INFO, WARN, ERROR, SUCCESS)
  - Download logs button
- **Metrics Tab:**
  - 4 metric cards with performance data
  - Time breakdown with progress bars
  - Comparison to average performance
- **Actions Tab:**
  - Retry, Cancel, Download, View in Notion
  - Duplicate configuration
  - Context-aware actions based on job status

**Highlights:**
- Slide-up modal animation
- Timeline with pulse animation for running steps
- Dark terminal-style log viewer
- Beautiful metric cards

---

### 5. **test-connection.html** - Connection Testing UI
Verify source configurations with live testing.

**Features:**
- Source selection (Figma / Slack)
- Configuration dropdown
- Test options checkboxes:
  - Check authentication
  - Verify permissions
  - Test webhook delivery
  - Check Notion connection
- **Live Testing:**
  - Real-time progress timeline
  - Step-by-step execution display
  - Pulsing indicators for running steps
  - Success/error states
- **Results Display:**
  - Test metrics (duration, checks passed, response time)
  - Detailed step timeline
  - Troubleshooting tips for failures
- **Test History:**
  - Last 10 test runs
  - Success/failure indicators
  - Timestamp and configuration details

**Highlights:**
- Animated timeline with staggered entries
- Pulse ring animation for active tests
- Gradient result cards
- Context-aware troubleshooting

---

## 🚀 How to Use

### Option 1: Open Directly in Browser
Simply open any HTML file in your browser:
```bash
open /tmp/discubot-ui-prototypes/index.html
```

Or drag and drop the files into your browser.

### Option 2: Use a Local Server
For the best experience with no CORS issues:
```bash
cd /tmp/discubot-ui-prototypes
python3 -m http.server 8000
```

Then visit: http://localhost:8000

---

## 🎯 Navigation Flow

The prototypes are interconnected:
1. **index.html** → Links to all other pages in sidebar
2. **config-form.html** → Back to dashboard
3. **job-monitor.html** → Click row actions → "View Details" → job-details.html
4. **test-connection.html** → Standalone testing interface

---

## 💡 Key Design Patterns

### Nuxt UI v4 Alignment
- **NO** UCard inside modals (common v3 mistake!)
- **Correct** component names: USeparator, USwitch, UDropdownMenu
- Modal structure: `<UModal><template #content>...</template></UModal>`
- Form patterns with validation
- Proper badge and alert styling

### Micro-Interactions
- Hover states on all interactive elements
- Smooth transitions (0.2s - 0.3s)
- Pulsing animations for live status
- Slide-in animations for modals
- Staggered timeline animations
- Progress bar animations

### Color Palette
- **Primary:** Indigo (rgb(99, 102, 241))
- **Success:** Green (#10b981)
- **Error:** Red (#ef4444)
- **Warning:** Amber (#f59e0b)
- **Info:** Blue (#3b82f6)
- **Figma:** Purple
- **Slack:** Pink

### Typography
- Headings: Bold, clear hierarchy
- Body: 0.875rem (14px) for readability
- Labels: Uppercase, letter-spaced, 0.75rem
- Monospace for IDs and technical values

---

## 🎨 Customization Tips

### Change Colors
Search for color values and replace:
```css
/* Primary color */
rgb(99, 102, 241) → your brand color

/* Success */
#10b981 → your success color
```

### Adjust Animations
Modify animation durations in `<style>` sections:
```css
transition: all 0.2s; /* Make faster/slower */
animation: pulse-dot 2s; /* Adjust pulse speed */
```

### Add Real Data
Replace mock data in Vue `data()` sections:
```javascript
data() {
  return {
    jobs: this.generateMockJobs() // Replace with API call
  }
}
```

---

## 🔧 Technical Stack

- **Vue 3** (via CDN) - Reactive framework
- **Tailwind CSS** (via CDN) - Utility-first styling
- **Custom CSS** - Animations and components
- **No build step** - Pure HTML/CSS/JS
- **Mobile responsive** - Adapts to all screen sizes

---

## 📱 Responsive Design

All prototypes are mobile-friendly:
- Sidebar collapses on mobile
- Tables scroll horizontally
- Modals adapt to screen size
- Grid layouts stack on small screens
- Touch-friendly hit targets

---

## 🎭 Demo Features

### Interactive Elements
- ✅ All buttons are clickable
- ✅ Forms validate on submit
- ✅ Tabs switch content
- ✅ Dropdowns open/close
- ✅ Checkboxes toggle
- ✅ Search/filter works
- ✅ Pagination navigates
- ✅ Test connection runs live simulation

### Mock Behaviors
- Connection tests simulate API calls with random success/failure
- Job monitor generates 47 random jobs
- Form validation shows errors
- Alerts appear on actions
- Progress bars animate

---

## 💼 Use Cases

### For Design Review
- Share HTML files with team
- Get feedback on layout and flow
- Test user interactions
- Validate information architecture

### For Development
- Reference for Nuxt UI v4 implementation
- Copy color schemes and spacing
- Use as component structure guide
- Extract animation CSS

### For Stakeholder Demos
- Show complete admin interface vision
- Demonstrate user flows
- Present without backend needed
- Interactive walkthroughs

---

## 🎓 Learning Resources

### Nuxt UI v4 Patterns
Each prototype demonstrates correct v4 usage:
- Modal without UCard wrapper
- Form with FormField components
- Proper badge naming
- Separator (not Divider)
- Switch (not Toggle)

### Animation Examples
- Pulse animations for live indicators
- Slide-in/fade-in for modals and alerts
- Staggered timeline entries
- Progress bar fills
- Hover state transitions

### Layout Techniques
- CSS Grid for responsive layouts
- Flexbox for component alignment
- Sticky positioning for sidebars
- Fixed positioning for modals
- Overflow handling for scrollable areas

---

## 🚀 Next Steps

### Ready to Implement?
1. Review each prototype in your browser
2. Note which patterns you like best
3. Extract color schemes and spacing
4. Use as reference for Phase 5 tasks
5. Adapt layouts to your Nuxt project

### Want to Customize?
1. Edit the HTML files directly
2. Modify colors in `<style>` sections
3. Update mock data in Vue `data()`
4. Add/remove features as needed
5. Test in multiple browsers

---

## 📝 Notes

- All files are standalone (no dependencies between them)
- CDN links require internet connection
- Mock data is randomly generated on each page load
- Animations work best in modern browsers (Chrome, Firefox, Safari, Edge)
- Test connection simulates real API delays (800ms - 1200ms per step)

---

## 🎉 Enjoy Exploring!

These prototypes are designed to inspire and guide your Phase 5 implementation. Feel free to mix and match patterns, adjust colors, and adapt layouts to fit your exact needs.

**Happy building! 🚀**
