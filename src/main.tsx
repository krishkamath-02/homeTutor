import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'

// Clean out any legacy mock/demo data from browser localStorage to keep state strictly authentic
try {
  ['hometutor_daily_homework', 'hometutor_saved_worksheets', 'hometutor_calendar_events_v1', 'hometutor_calendar_events_v2'].forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const cleaned = parsed.filter((item: any) => 
          !String(item.id).startsWith('dh-demo-') && 
          !String(item.id).startsWith('ws-sample-') && 
          !String(item.id).startsWith('evt-') &&
          !String(item.id).startsWith('demo-')
        );
        localStorage.setItem(key, JSON.stringify(cleaned));
      }
    }
  });
} catch {}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
