import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { captureMonitoringMessage } from "@/lib/monitoring";

let webVitalsInitialized = false;

const reportMetric = (metric: Metric) => {
  const payload = {
    id: metric.id,
    metric_name: metric.name,
    navigation_type: metric.navigationType,
    rating: metric.rating,
    value: Number(metric.value.toFixed(2)),
  };

  trackAnalyticsEvent("web_vital_recorded", payload);

  captureMonitoringMessage("Web vital recorded", payload);
};

export const initializeWebVitals = () => {
  if (webVitalsInitialized || typeof window === "undefined") {
    return;
  }

  onCLS(reportMetric);
  onFCP(reportMetric);
  onINP(reportMetric);
  onLCP(reportMetric);
  onTTFB(reportMetric);

  webVitalsInitialized = true;
};
