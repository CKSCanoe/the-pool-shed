/**
 * Pool Shed Configuration Module
 * Centralized configuration management with environment support
 */

class PoolShedConfig {
  constructor() {
    this.config = {
      supabaseUrl: '',
      supabasePublishableKey: '',
      environment: 'production',
      features: {
        offlineMode: true,
        catalogueIntelligence: true,
        bundleEngine: true,
        partialFulfillment: true,
        productImages: true,
        salesOrderSearch: true,
        catalogueHealth: true
      },
      cache: {
        maxAge: 31536000,
        staleWhileRevalidate: 604800
      },
      logging: {
        enabled: true,
        level: 'info' // 'debug', 'info', 'warn', 'error'
      },
      version: '1.0.0'
    };
    this.initialized = false;
  }

  /**
   * Initialize configuration from environment and window globals
   */
  init(windowConfig = {}) {
    try {
      // Load from window.POOL_SHED_CONFIG if available
      if (windowConfig && typeof windowConfig === 'object') {
        this.config.supabaseUrl = windowConfig.supabaseUrl || this.config.supabaseUrl;
        this.config.supabasePublishableKey = windowConfig.supabasePublishableKey || this.config.supabasePublishableKey;
      }

      // Validate critical configuration
      if (!this.config.supabaseUrl || !this.config.supabasePublishableKey) {
        this.log('warn', 'Supabase credentials not configured. Authentication will not work.', {
          hasUrl: !!this.config.supabaseUrl,
          hasKey: !!this.config.supabasePublishableKey
        });
      }

      this.initialized = true;
      this.log('info', 'Configuration initialized successfully', {
        environment: this.config.environment,
        features: Object.keys(this.config.features).filter(k => this.config.features[k])
      });
    } catch (error) {
      this.log('error', 'Configuration initialization failed', { error: error.message });
      throw new Error(`Config initialization failed: ${error.message}`);
    }
  }

  /**
   * Get configuration value by path (e.g., 'features.bundleEngine')
   */
  get(path, defaultValue = undefined) {
    const keys = path.split('.');
    let value = this.config;
    for (const key of keys) {
      value = value?.[key];
    }
    return value !== undefined ? value : defaultValue;
  }

  /**
   * Check if a feature is enabled
   */
  isFeatureEnabled(featureName) {
    return this.config.features[featureName] === true;
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures() {
    return Object.keys(this.config.features).filter(k => this.config.features[k]);
  }

  /**
   * Internal logging method
   */
  log(level, message, data = {}) {
    if (!this.config.logging.enabled) return;
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    console.log(`[${level.toUpperCase()}] ${message}`, data);
  }

  /**
   * Get current configuration state (for debugging)
   */
  getState() {
    return JSON.parse(JSON.stringify(this.config));
  }
}

// Export singleton instance
window.PoolShedConfig = window.PoolShedConfig || new PoolShedConfig();
export default window.PoolShedConfig;
