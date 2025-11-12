# Discubot Admin UI - Nuxt UI Prototypes

Beautiful, interactive UI prototypes built with **Vue 3 + Vite + Nuxt UI v4**. These prototypes use REAL Nuxt UI components, making them much closer to the actual Phase 5 implementation.

## 🎨 What's Different from HTML Prototypes?

**HTML Prototypes** (`/docs/prototypes/`):
- Pure HTML/CSS/JS
- Custom styling
- No real component library
- Open directly in browser
- Good for visual inspiration

**Nuxt UI Prototypes** (`/docs/prototypes-nuxt-ui/`):
- Real Nuxt UI v4 components ✨
- Proper Vue 3 Composition API
- Uses `<UButton>`, `<UCard>`, `<UBadge>`, `<UIcon>`, etc.
- Requires npm install + dev server
- Much closer to actual implementation

## 🚀 Quick Start

### Installation
```bash
cd docs/prototypes-nuxt-ui
npm install
```

### Development
```bash
npm run dev
```

Then open **http://localhost:5173** in your browser!

### Build for Production
```bash
npm run build
npm run preview
```

## 📁 Project Structure

```
prototypes-nuxt-ui/
├── src/
│   ├── App.vue              # Main app with sidebar navigation
│   ├── main.js              # App entry point with router & Nuxt UI
│   ├── style.css            # Global styles (imports Tailwind + Nuxt UI)
│   └── pages/
│       ├── Dashboard.vue     # ✅ Main dashboard (COMPLETE)
│       ├── SourceConfig.vue  # 🚧 Config forms (placeholder)
│       ├── JobMonitor.vue    # 🚧 Job table (placeholder)
│       ├── JobDetails.vue    # 🚧 Job details (placeholder)
│       └── TestConnection.vue # 🚧 Testing UI (placeholder)
├── index.html               # HTML template
├── vite.config.js           # Vite config with Nuxt UI plugin
└── package.json             # Dependencies
```

## 🎯 Current Status

### ✅ Complete
- **Project setup** - Vite + Vue 3 + Nuxt UI v4
- **Routing** - Vue Router with 5 pages
- **Sidebar navigation** - With active state and icons
- **Dashboard page** - Real Nuxt UI components:
  - `<UCard>` for stat cards and sections
  - `<UBadge>` for status indicators
  - `<UButton>` for actions
  - `<UIcon>` for icons (Heroicons)
  - `<UProgress>` for progress bars
  - `<UColorModeButton>` for dark mode toggle
- **Responsive layout** - Works on all screen sizes
- **Dark mode** - Built-in via Nuxt UI

### 🚧 To Do (Placeholders for now)
- **Source Config page** - Forms with `<UForm>`, `<UFormField>`, `<UInput>`, `<UTabs>`
- **Job Monitor page** - Table with `<UTable>`, filters, pagination
- **Job Details page** - Modal/page with `<UTabs>`, timelines, logs
- **Test Connection page** - Testing interface with real-time feedback

## 🎨 Nuxt UI Components Used

### Dashboard Page Examples

**Stat Cards:**
```vue
<UCard class="hover:-translate-y-1 transition-transform">
  <div class="flex items-center justify-between mb-4">
    <div class="p-3 bg-primary-100 rounded-lg">
      <UIcon name="i-heroicons-arrow-path" class="w-6 h-6 text-primary-600" />
    </div>
    <UBadge color="green" variant="subtle">+12.5%</UBadge>
  </div>
  <p class="text-3xl font-bold">24,783</p>
  <p class="text-sm text-gray-500">Total Syncs</p>
  <UProgress :value="96.8" color="green" class="mt-3" />
</UCard>
```

**Buttons:**
```vue
<UButton icon="i-heroicons-plus" color="primary">
  New Source
</UButton>

<UButton block variant="outline" color="primary" icon="i-heroicons-plus">
  <span class="flex-1 text-left">
    <p class="font-medium">Add Figma Source</p>
    <p class="text-xs text-gray-500">Connect new project</p>
  </span>
</UButton>
```

**Badges:**
```vue
<UBadge color="green" variant="subtle">Completed</UBadge>
<UBadge color="amber" variant="subtle">Processing</UBadge>
<UBadge color="red" variant="solid" size="xs">3</UBadge>
```

**Icons:**
```vue
<UIcon name="i-heroicons-home" class="w-5 h-5" />
<UIcon name="i-heroicons-bolt" class="w-6 h-6 text-amber-600" />
```

## 🎯 Next Steps

When you're ready to implement Phase 5, you can:

1. **Copy component patterns** from these prototypes
2. **Use the same Nuxt UI components** in your actual Nuxt app
3. **Reference prop usage** - see how components are configured
4. **Adapt layouts** - the structure translates directly to Nuxt

## 💡 Key Differences vs HTML Prototypes

| Feature | HTML Prototypes | Nuxt UI Prototypes |
|---------|----------------|-------------------|
| Components | Custom CSS | Real Nuxt UI v4 |
| Setup | None, open in browser | `npm install` required |
| Interactivity | Basic Vue 3 | Full Vue 3 + Router |
| Styling | Custom classes | Nuxt UI + Tailwind |
| Dark Mode | Manual toggle | Built-in `<UColorModeButton>` |
| Icons | SVG inline | `<UIcon>` with Heroicons |
| Forms | HTML inputs | `<UForm>`, `<UInput>`, etc. |
| Tables | HTML table | `<UTable>` (when added) |
| Best for | Visual inspiration | Implementation reference |

## 📚 Resources

- **Nuxt UI Docs**: https://ui.nuxt.com
- **Vue 3 Docs**: https://vuejs.org
- **Heroicons**: https://heroicons.com (used via `i-heroicons-*`)
- **Tailwind CSS**: https://tailwindcss.com

## 🔧 Customization

### Change Colors
Nuxt UI uses Tailwind's color system. The primary color is indigo by default:

```vue
<UButton color="primary">Button</UButton>  <!-- Indigo -->
<UButton color="green">Button</UButton>    <!-- Green -->
<UButton color="red">Button</UButton>      <!-- Red -->
```

### Add New Pages
1. Create a new file in `src/pages/`
2. Add route in `src/main.js`
3. Add navigation link in `src/App.vue`

### Use More Components
Check the Nuxt UI docs for all available components:
- Forms: `<UForm>`, `<UFormField>`, `<UInput>`, `<UTextarea>`, `<USelect>`
- Data: `<UTable>`, `<UPagination>`, `<UTimeline>`
- Overlays: `<UModal>`, `<USlideover>`, `<UDropdownMenu>`
- Feedback: `<UAlert>`, `<UToast>`, `<USkeleton>`

## 🎉 Benefits

1. **Real components** - Use actual Nuxt UI v4, not approximations
2. **Type safety** - TypeScript support out of the box
3. **Hot reload** - Changes reflect instantly
4. **Production ready** - Can build and deploy
5. **Learn by doing** - Hands-on with Nuxt UI APIs
6. **Easy transition** - Copy/paste into actual Nuxt app

## 🐛 Troubleshooting

**Port already in use:**
```bash
# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

**Components not loading:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Styles not working:**
```bash
# Ensure Tailwind CSS is imported in src/style.css
@import "tailwindcss";
@import "@nuxt/ui";
```

## 📝 Notes

- This is a **standalone Vue 3 app**, not a full Nuxt app
- It uses **Nuxt UI for Vue** (not the full Nuxt module)
- Perfect for prototyping before Phase 5 implementation
- All mock data is hardcoded in components
- Dark mode works automatically via `<UColorModeButton>`

---

**Happy prototyping! 🚀**

When you're ready for Phase 5, these prototypes will make implementation much faster since you'll already know the component APIs!
