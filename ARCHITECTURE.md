# Pool Shed Architecture & Code Organization

## Overview

The Pool Shed is a professional warehouse and sales management application built with vanilla JavaScript, organized into logical modules with clear separation of concerns.

## Directory Structure

```
the-pool-shed/
├── src/                          # Source code modules
│   ├── config/                   # Configuration management
│   │   └── index.js              # Centralized config (replaces public/config.js)
│   ├── core/                     # Core initialization & lifecycle
│   │   └── initialization.js     # Safe startup sequence with error recovery
│   ├── services/                 # Service layer
│   │   ├── error-handler.js      # Global error handling & logging
│   │   └── performance-monitor.js # Performance metrics & monitoring
│   └── utils/                    # Utility functions (future)
│
├── public/                       # Build output & static assets
│   ├── index.html                # Main HTML entry point
│   ├── assets/                   # CSS & JS bundles (generated/maintained)
│   │   ├── css/                  # Organized by version/feature
│   │   └── js/                   # Organized by version/feature
│   ├── bundle-*.js/.css          # Feature bundles
│   ├── service-worker.js         # Offline cache & PWA
│   └── config.js                 # Generated from build (do not edit)
│
├── scripts/                      # Build & validation scripts
│   ├── build.sh                  # Main build process
│   ├── validate-runtime.mjs      # Pre-deployment validation
│   └── test-*.mjs                # Feature tests
│
├── .env.example                  # Configuration template
├── package.json                  # Dependencies & scripts
├── vercel.json                   # Deployment config
└── ARCHITECTURE.md               # This file
```

## Module Guide

### Configuration (`src/config/index.js`)

**Purpose:** Centralized configuration management with environment variable support.

**Key Features:**
- Load config from environment variables
- Feature flag management
- Configuration validation
- Single source of truth for app settings

**Usage:**
```javascript
import PoolShedConfig from './src/config/index.js';

// Initialize
PoolShedConfig.init(window.POOL_SHED_CONFIG);

// Use
if (PoolShedConfig.isFeatureEnabled('bundleEngine')) {
  // Load bundle engine
}

const url = PoolShedConfig.get('supabaseUrl');
```

### Initialization (`src/core/initialization.js`)

**Purpose:** Orchestrate safe app startup with error recovery.

**Key Features:**
- Register initialization stages
- Distinguish critical vs. non-critical stages
- Error collection without failure (unless critical)
- Performance timing
- Detailed logging

**Usage:**
```javascript
import PoolShedInitializer from './src/core/initialization.js';

PoolShedInitializer.registerStage('bundle-engine', () => {
  // Load and initialize bundle engine
}, true); // critical flag

PoolShedInitializer.registerStage('optional-feature', () => {
  // Won't crash app if it fails
}, false);

const result = await PoolShedInitializer.run(window.POOL_SHED_CONFIG);
console.log(result); // { success, duration, warnings, errors }
```

### Error Handling (`src/services/error-handler.js`)

**Purpose:** Catch and log all runtime errors with context.

**Key Features:**
- Automatic uncaught error capturing
- Unhandled promise rejection handling
- Error history (last 100 errors)
- Subscriber pattern for custom handlers
- No silent failures

**Usage:**
```javascript
import ErrorHandler from './src/services/error-handler.js';

// Initialize
ErrorHandler.init();

// Subscribe to errors
ErrorHandler.subscribe((error) => {
  // Send to monitoring service
  console.log('Error occurred:', error);
});

// Manual logging
ErrorHandler.log({ message: 'Custom error', data: {} });

// Get history
const history = ErrorHandler.getHistory();
```

### Performance Monitoring (`src/services/performance-monitor.js`)

**Purpose:** Track load times and identify bottlenecks.

**Key Features:**
- Performance marks and measures
- Core Web Vitals tracking
- Measurement history
- Non-blocking (failures don't crash app)

**Usage:**
```javascript
import PerformanceMonitor from './src/services/performance-monitor.js';

PerformanceMonitor.mark('app-start');

// ... do work ...

PerformanceMonitor.mark('app-ready');
const loadTime = PerformanceMonitor.measure(
  'app-load',
  'app-start',
  'app-ready'
);
console.log(`App loaded in ${loadTime}ms`);
```

## Initialization Sequence

```
1. HTML loads
2. config.js runs (populates window.POOL_SHED_CONFIG)
3. PoolShedConfig.init() called
4. PoolShedInitializer stages run:
   - Service worker registration
   - Core app initialization
   - Feature module loading (bundle-engine, etc)
   - UI framework initialization
5. Error handlers attached
6. Performance monitoring activated
7. App rendered
```

## Build Process

### Scripts

- **`npm run build`** - Build for deployment
  1. Copy public/ → dist/
  2. Inject Supabase config from env vars
  3. Run runtime validation
  4. Output to dist/

- **`npm run validate`** - Run all validation tests
  - Syntax checking
  - Feature completeness verification
  - Integration tests
  - Partial fulfillment behavior tests

- **`npm run test:*`** - Run specific feature tests

## Configuration

### Environment Variables

Create `.env` (from `.env.example`):

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
NODE_ENV=production
```

During build, `scripts/build.sh` injects these into `dist/config.js`.

### Feature Flags

In `src/config/index.js`:

```javascript
features: {
  offlineMode: true,
  catalogueIntelligence: true,
  bundleEngine: true,
  partialFulfillment: true,
  // ...
}
```

Check at runtime:

```javascript
if (PoolShedConfig.isFeatureEnabled('bundleEngine')) {
  // load feature
}
```

## Security Best Practices

1. **Config Security**
   - Never commit `.env` files
   - Inject sensitive values at build time
   - Use `Supabase-publishable` key (not admin key) in client

2. **Error Handling**
   - Don't expose stack traces to users
   - Log errors server-side for analysis
   - Fail gracefully with user-friendly messages

3. **Input Validation**
   - Validate in service worker requests
   - Sanitize DOM output (use existing `escapeHtml` function)
   - Validate form submissions

## Performance Optimization

### Current Issues

1. **Multiple CSS/JS Files**
   - 23+ stylesheets loaded with `defer`
   - Consider bundling related features
   - Use code splitting for large features

2. **MutationObserver Overhead**
   - `pool-shed-overhaul.js` observes entire DOM
   - Could cause jank with heavy updates
   - Consider event-based approach

3. **Minification**
   - Files are hand-minified (hard to maintain)
   - Consider build tool (Vite, esbuild, Rollup)

### Recommendations

1. **Phase 1: Organize & Validate**
   - Implement modular structure (already done in this refactor)
   - Add comprehensive error handling
   - Add performance monitoring

2. **Phase 2: Build Tooling**
   - Integrate a bundler (Vite recommended)
   - Generate source maps for debugging
   - Minimize bundle size

3. **Phase 3: Code Splitting**
   - Lazy-load large features (bundle-engine, catalogue-intelligence)
   - Prioritize critical path
   - Optimize for Core Web Vitals

## Testing Strategy

### Current Validation

- `scripts/validate-runtime.mjs` - Comprehensive deployment checks
- Tests for:
  - Syntax validation
  - Feature completeness
  - Integration behavior
  - Partial fulfillment workflow
  - Catalogue intelligence ranking

### Future Testing

- Unit tests for utilities
- Integration tests for workflows
- E2E tests for critical paths
- Performance regression tests

## Monitoring & Debugging

### Development

```javascript
// In browser console
PoolShedConfig.getState()        // View config
PoolShedErrorHandler.getHistory() // View errors
PoolShedPerformanceMonitor.getMeasures() // View performance
```

### Production

- Collect error logs and send to monitoring service
- Track performance metrics (LCP, FID, CLS)
- Monitor Supabase connection failures
- Track offline fallback usage

## Migration Guide

For existing code using `window.data`, `window.render()`, etc.:

1. Features remain at `public/bundle-*.js` (no change)
2. Access config via `PoolShedConfig.get()` instead of `window.POOL_SHED_CONFIG`
3. New code should use modular approach
4. Gradually migrate features to src/ structure

## Next Steps

1. ✅ Implement modular config system
2. ✅ Add centralized error handling
3. ✅ Add performance monitoring
4. 🔄 Migrate bundle-engine to modular structure
5. 🔄 Migrate catalogue-intelligence to modular structure
6. 🔄 Implement build tool for bundling
7. 🔄 Add comprehensive test suite
