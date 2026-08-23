/**
 * Global Error Handler Service
 * Catches and logs all runtime errors with context
 */

class ErrorHandler {
  constructor() {
    this.errorLog = [];
    this.maxLogSize = 100; // Keep last 100 errors
    this.subscribers = [];
  }

  /**
   * Initialize error handlers
   */
  init() {
    window.addEventListener('error', (event) => this.handleError(event));
    window.addEventListener('unhandledrejection', (event) => this.handleRejection(event));
  }

  /**
   * Handle uncaught errors
   */
  handleError(event) {
    const error = {
      type: 'error',
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent
    };

    this.log(error);
    this.notifySubscribers(error);

    // Don't prevent default for reporting services
    return false;
  }

  /**
   * Handle unhandled promise rejections
   */
  handleRejection(event) {
    const error = {
      type: 'unhandledRejection',
      reason: event.reason?.message || String(event.reason),
      promise: event.promise,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.log(error);
    this.notifySubscribers(error);

    // Prevent default rejection handling
    event.preventDefault();
  }

  /**
   * Manually log an error
   */
  log(error) {
    this.errorLog.push(error);
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog.shift();
    }

    if (window.console) {
      console.error('[POOL-SHED-ERROR]', error);
    }
  }

  /**
   * Subscribe to error events
   */
  subscribe(callback) {
    this.subscribers.push(callback);
  }

  /**
   * Notify all subscribers
   */
  notifySubscribers(error) {
    this.subscribers.forEach(cb => {
      try {
        cb(error);
      } catch (e) {
        console.error('Error in error subscriber', e);
      }
    });
  }

  /**
   * Get error history
   */
  getHistory() {
    return [...this.errorLog];
  }

  /**
   * Clear error history
   */
  clear() {
    this.errorLog = [];
  }
}

window.PoolShedErrorHandler = window.PoolShedErrorHandler || new ErrorHandler();
export default window.PoolShedErrorHandler;
