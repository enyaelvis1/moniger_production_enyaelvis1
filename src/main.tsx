import { createRoot } from "react-dom/client";
import { ThemeProvider } from "./hooks/use-theme.tsx";
import App from "./App.tsx";
import { initializeAnalytics } from "./lib/analytics.ts";
import { initializeErrorMonitoring } from "./lib/error-handling.ts";
import { initializeMonitoring } from "./lib/monitoring.ts";
import { initializeWebVitals } from "./lib/web-vitals.ts";
import "./index.css";

initializeMonitoring();
initializeAnalytics();
initializeErrorMonitoring();
initializeWebVitals();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
