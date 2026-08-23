/**
 * Performance Monitoring Service
 * Tracks load times and identifies bottlenecks
 */

class PerformanceMonitor {
  constructor() {
    this.marks = new Map();
    this.measures = [];
  }

  /**
   * Mark a point in time
   */
  mark(label) {
    if (!window.performance) return;
    try {
      window.performance.mark(`pool-shed-${label}`);
      this.marks.set(label, Date.now());
    } catch (e) {
      console.warn('Performance mark failed:', label);
    }
  }

  /**
   * Measure time between two marks
   */
  measure(label, startMark, endMark) {
    if (!window.performance) return null;
    try {
      const measureName = `pool-shed-${label}`;
      window.performance.measure(
        measureName,
        `pool-shed-${startMark}`,
        `pool-shed-${endMark}`
      );

      const entry = window.performance.getEntriesByName(measureName)[0];
      const duration = entry?.duration || 0;

      this.measures.push({
        label,
        duration,
        timestamp: new Date().toISOString()
      });

      return duration;
    } catch (e) {
      console.warn('Performance measure failed:', label);
      return null;
    }
  }

  /**
   * Get Core Web Vitals
   */
  getWebVitals() {
    const vitals = {};

    // Largest Contentful Paint (LCP)
    if (window.performance?.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1];
          vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
        });
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        console.warn('LCP observer failed');
      }
    }

    // First Input Delay (FID) via PerformanceObserver
    if (window.performance?.PerformanceObserver) {
      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach(entry => {
            vitals.fid = entry.processingDuration;
          });
        });
        observer.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        console.warn('FID observer failed');
      }
    }

    return vitals;
  }

  /**
   * Get all measurements
   */
  getMeasures() {
    return [...this.measures];
  }

  /**
   * Clear measurements
   */
  clear() {
    this.marks.clear();
    this.measures = [];
  }
}

window.PoolShedPerformanceMonitor = window.PoolShedPerformanceMonitor || new PerformanceMonitor();
export default window.PoolShedPerformanceMonitor;
