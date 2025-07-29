export class PerformanceManager {
  private static metrics = new Map<string, number>();

  // Measure and report performance
  static measure(name: string, fn: () => Promise<any>): Promise<any> {
    const start = performance.now();

    return fn().finally(() => {
      const duration = performance.now() - start;
      this.metrics.set(name, duration);

      // Report to analytics if available
      if (typeof window !== 'undefined' && 'gtag' in window) {
        (window as any).gtag('event', 'performance_measure', {
          metric_name: name,
          duration: Math.round(duration),
        });
      }
    });
  }

  // Bundle analysis
  static reportBundleSize(): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming;

      console.log('Bundle Performance:', {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded:
          navigation.domContentLoadedEventEnd -
          navigation.domContentLoadedEventStart,
        transferSize: navigation.transferSize,
        encodedBodySize: navigation.encodedBodySize,
      });
    }
  }
}
