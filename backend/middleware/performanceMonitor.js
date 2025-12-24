/**
 * Performance Monitor - Track API performance metrics
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      avgResponseTime: 0,
      slowQueries: 0,
      errors: 0
    };
  }

  // Middleware to track request performance
  trackRequest() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.totalRequests++;

      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        
        // Update average response time
        this.metrics.avgResponseTime = 
          (this.metrics.avgResponseTime + responseTime) / 2;
        
        // Track slow queries (>1000ms)
        if (responseTime > 1000) {
          this.metrics.slowQueries++;
          console.warn(`⚠️ Slow query: ${req.method} ${req.path} - ${responseTime}ms`);
        }
        
        // Track errors
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
      });

      next();
    };
  }

  // Get current metrics
  getMetrics() {
    return {
      ...this.metrics,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      avgResponseTime: Math.round(this.metrics.avgResponseTime)
    };
  }

  // Reset metrics
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      avgResponseTime: 0,
      slowQueries: 0,
      errors: 0
    };
  }
}

const monitor = new PerformanceMonitor();

module.exports = monitor;