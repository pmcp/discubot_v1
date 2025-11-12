import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import ui from '@nuxt/ui/vue-plugin'
import './style.css'
import App from './App.vue'

// Import pages
import Dashboard from './pages/Dashboard.vue'
import SourceConfig from './pages/SourceConfig.vue'
import JobMonitor from './pages/JobMonitor.vue'
import JobDetails from './pages/JobDetails.vue'
import TestConnection from './pages/TestConnection.vue'

// Create router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/config', name: 'config', component: SourceConfig },
    { path: '/jobs', name: 'jobs', component: JobMonitor },
    { path: '/jobs/:id', name: 'job-details', component: JobDetails },
    { path: '/test', name: 'test', component: TestConnection },
  ]
})

const app = createApp(App)
app.use(router)
app.use(ui)
app.mount('#app')
