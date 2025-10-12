// Cleanup middleware for memory management
const cleanupManager = {
  userCache: null, // Will be set by auth middleware
  performanceMonitor: null, // Will be set by main app
  
  // Initialize cleanup manager
  init(userCache, performanceMonitor) {
    this.userCache = userCache;
    this.performanceMonitor = performanceMonitor;
    
    // Run cleanup every 10 minutes
    setInterval(() => {
      this.runCleanup();
    }, 10 * 60 * 1000);
    
    console.log('✅ Cleanup manager initialized');
  },
  
  // Run all cleanup operations
  runCleanup() {
    const startTime = Date.now();
    
    try {
      // Clean expired cache entries
      this.cleanUserCache();
      
      // Reset performance metrics if they get too large
      this.cleanPerformanceMetrics();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const cleanupTime = Date.now() - startTime;
      console.log(`🧹 Cleanup completed in ${cleanupTime}ms`);
      
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  },
  
  // Clean expired user cache entries
  cleanUserCache() {
    if (!this.userCache) return;
    
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, data] of this.userCache.entries()) {
      if (now > data.expiry) {
        this.userCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🗑️ Cleaned ${cleanedCount} expired cache entries`);
    }
  },
  
  // Reset performance metrics if memory usage is high
  cleanPerformanceMetrics() {
    if (!this.performanceMonitor) return;
    
    const metrics = this.performanceMonitor.getMetrics();
    
    // If we have processed a lot of requests, reset metrics
    if (metrics.totalRequests > 10000) {
      this.performanceMonitor.resetMetrics();
      console.log('📊 Performance metrics reset after 10k requests');
    }
  },
  
  // Get memory usage info
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(usage.external / 1024 / 1024) + ' MB',
      cacheSize: this.userCache ? this.userCache.size : 0
    };
  }
};

module.exports = cleanupManager;