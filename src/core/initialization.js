/**
 * Pool Shed Core Initialization Module
 * Handles safe startup sequence with error recovery
 */

import PoolShedConfig from '../config/index.js';

class PoolShedInitializer {
  constructor() {
    this.initStages = [];
    this.errors = [];
    this.warnings = [];
    this.startTime = Date.now();
  }

  /**
   * Register an initialization stage
   */
  registerStage(name, fn, critical = false) {
    this.initStages.push({ name, fn, critical });
  }

  /**
   * Run all initialization stages with error handling
   */
  async run(windowConfig = {}) {
    try {
      // Step 1: Initialize configuration
      PoolShedConfig.init(windowConfig);
      this.log('Configuration loaded', { stage: 'config' });

      // Step 2: Run registered stages
      for (const stage of this.initStages) {
        try {
          this.log(`Starting stage: ${stage.name}`, { stage: stage.name });
          await Promise.resolve(stage.fn());
          this.log(`✓ ${stage.name} complete`, { stage: stage.name });
        } catch (error) {
          const msg = `Stage failed: ${stage.name} - ${error.message}`;
          if (stage.critical) {
            this.errors.push(msg);
            this.log(`✗ CRITICAL FAILURE: ${stage.name}`, { error: error.message });
            throw error;
          } else {
            this.warnings.push(msg);
            this.log(`⚠ Non-critical stage failed: ${stage.name}`, { error: error.message });
          }
        }
      }

      const duration = Date.now() - this.startTime;
      this.log(`Initialization complete in ${duration}ms`, {
        duration,
        stages: this.initStages.length,
        warnings: this.warnings.length
      });

      return {
        success: true,
        duration,
        warnings: this.warnings,
        errors: this.errors
      };
    } catch (error) {
      const duration = Date.now() - this.startTime;
      this.log(`Initialization FAILED after ${duration}ms`, {
        error: error.message,
        warnings: this.warnings,
        errors: this.errors
      });
      return {
        success: false,
        duration,
        warnings: this.warnings,
        errors: this.errors,
        fatalError: error.message
      };
    }
  }

  /**
   * Log initialization event
   */
  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    if (window.console && window.console.log) {
      console.log(`[POOL-SHED-INIT] ${message}`, data);
    }
  }
}

// Export singleton
window.PoolShedInitializer = window.PoolShedInitializer || new PoolShedInitializer();
export default window.PoolShedInitializer;
