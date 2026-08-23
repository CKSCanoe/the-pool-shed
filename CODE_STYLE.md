# Pool Shed Code Style Guide

## JavaScript Style

### Naming Conventions

```javascript
// ✅ DO: Use camelCase for variables and functions
const userEmail = 'user@example.com';
function fetchUserData() { }

// ✅ DO: Use PascalCase for classes
class PoolShedConfig { }
class ErrorHandler { }

// ✅ DO: Use CONSTANT_CASE for constants
const MAX_RETRIES = 3;
const CACHE_VERSION = 'pool-shed-app-v1';

// ❌ DON'T: Use single letter variables (except loops)
const p = product;  // Bad
const product = getProduct(id);  // Good

for (let i = 0; i < items.length; i++) { }  // OK - loop index
```

### Code Organization

```javascript
// 1. Imports
import PoolShedConfig from '../config/index.js';

// 2. Constants
const MAX_CACHE_SIZE = 100;
const DEFAULT_TIMEOUT = 5000;

// 3. Class/Function definitions
class MyService {
  constructor() { }
  publicMethod() { }
  #privateMethod() { }  // Use # for private
}

// 4. Exports
export default MyService;
```

### Comments

```javascript
// ✅ DO: Use clear, descriptive comments
/**
 * Fetch product data from Supabase
 * @param {string} productId - The product identifier
 * @returns {Promise<Object>} Product data or null
 */
async function fetchProduct(productId) { }

// ✅ DO: Explain WHY, not WHAT
// Workaround for Safari timezone bug - see #1234
const adjustedDate = new Date(timestamp.getTime() + offset);

// ❌ DON'T: State the obvious
const count = 0;  // Set count to 0
```

### Error Handling

```javascript
// ✅ DO: Handle errors explicitly
try {
  const data = await fetchData();
  process(data);
} catch (error) {
  ErrorHandler.log({
    message: 'Failed to fetch data',
    error: error.message,
    stack: error.stack
  });
  // Handle gracefully or re-throw
}

// ❌ DON'T: Silently swallow errors
try {
  doSomething();
} catch (_) {
  // Silent failure - hard to debug!
}
```

### Async/Await

```javascript
// ✅ DO: Use async/await for readability
async function loadData() {
  try {
    const response = await fetch('/api/data');
    const data = await response.json();
    return data;
  } catch (error) {
    throw new Error(`Failed to load: ${error.message}`);
  }
}

// ✅ DO: Handle promise errors
Promise.resolve()
  .then(doSomething)
  .catch(handleError);

// ❌ DON'T: Mix promises and async/await unnecessarily
.then(result => async () => { ... })  // Confusing
```

### Null/Undefined Checks

```javascript
// ✅ DO: Use optional chaining and nullish coalescing
const name = user?.name ?? 'Anonymous';
const size = array?.length ?? 0;

// ✅ DO: Be explicit about falsy values
if (value !== null && value !== undefined) {
  process(value);
}

// ❌ DON'T: Use loose equality with null
if (value == null) {  // Checks both null and undefined
  // This is OK, but be explicit
}
```

## CSS Style

### Organization

```css
/* ✅ DO: Group related styles */
:root {
  /* Colors */
  --brand: #006e8e;
  --accent: #00a6c8;
  /* Spacing */
  --gap: 1rem;
  --padding: 1.2rem;
  /* Other */
  --shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
}

/* Base styles */
body {
  font-family: Inter, system-ui, sans-serif;
  color: var(--ink);
}

/* Component styles */
.button { }
.button.primary { }
.button:hover { }

/* ❌ DON'T: Random ordering */
.thing-1 { }
.random { }
.thing-2 { }
```

### Class Naming

```css
/* ✅ DO: Use kebab-case */
.sales-order-row { }
.bundle-line-head { }
.product-image-cell { }

/* ✅ DO: Be specific and descriptive */
.modal-backdrop { }
.form-error-message { }

/* ❌ DON'T: Use cryptic abbreviations */
.so-row { }  /* Unclear */
.h1-bd { }   /* What is this? */
```

### Variables

```css
/* ✅ DO: Use CSS custom properties for consistency */
button {
  background: var(--brand);
  color: var(--text-light);
  padding: var(--gap);
}

/* ✅ DO: Define related variables together */
:root {
  --color-success: #168657;
  --color-success-light: #e5f4ed;
  --color-success-dark: #0f5a3a;
}

/* ❌ DON'T: Hardcode colors */
button {
  background: #006e8e;  /* Use variable instead */
}
```

## File Structure

```
src/
├── config/
│   └── index.js          # Configuration
├── core/
│   └── initialization.js # Core setup
├── services/
│   ├── error-handler.js  # Error handling
│   ├── performance-monitor.js
│   └── [service].js
├── utils/
│   ├── validation.js
│   ├── formatting.js
│   └── [utility].js
└── README.md             # Module documentation
```

### Module Template

```javascript
/**
 * Module Name
 * Brief description of what this module does
 */

import SomeDependency from './dependency.js';

/**
 * Class/Function description
 */
class MyModule {
  constructor() {
    // Initialize
  }

  /**
   * Public method description
   * @param {string} param - Description
   * @returns {Promise<void>}
   */
  async publicMethod(param) {
    // Implementation
  }

  /**
   * Private method - not part of public API
   */
  #privateMethod() {
    // Implementation
  }
}

// Export as singleton or class
export default new MyModule();
// or
export default MyModule;
```

## Testing & Validation

### Syntax Validation

```bash
# Run build validation
npm run validate

# Check for common issues
# - Syntax errors
# - Missing required files
# - Feature completeness
# - Integration issues
```

### Manual Code Review

```javascript
// ✅ Before committing, check:
// - No console.error without ErrorHandler.log
// - No silent catch blocks
// - No hardcoded credentials
// - No overly complex functions (break into smaller ones)
// - All error paths handled
// - Performance implications considered
```

## Common Patterns

### Error Handling Pattern

```javascript
try {
  const result = await doSomething();
  return result;
} catch (error) {
  const context = {
    message: 'Descriptive error message',
    error: error.message,
    data: { /* relevant context */ }
  };
  ErrorHandler.log(context);
  
  // Decide: re-throw or return fallback
  if (error instanceof CriticalError) {
    throw error;  // Let caller handle
  }
  return null;  // Graceful degradation
}
```

### Module Initialization Pattern

```javascript
class MyModule {
  async init() {
    try {
      // Step 1: Load config
      const config = PoolShedConfig.get('myModule');
      
      // Step 2: Validate dependencies
      if (!config) throw new Error('Config missing');
      
      // Step 3: Initialize
      await this.setup(config);
      
      // Step 4: Report success
      PerformanceMonitor.mark('myModule-ready');
      return { success: true };
    } catch (error) {
      ErrorHandler.log({ message: 'Init failed', error: error.message });
      return { success: false, error: error.message };
    }
  }
}
```

## Pre-commit Checklist

- [ ] No hardcoded credentials
- [ ] No `console.log()` in production code (use ErrorHandler)
- [ ] All error paths handled
- [ ] No silent catch blocks (`catch (_) {}`)
- [ ] Functions have clear purpose and reasonable length
- [ ] Comments explain WHY, not WHAT
- [ ] CSS uses variables, not hardcoded values
- [ ] File naming is clear and descriptive
- [ ] Module exports are explicit
- [ ] Tests pass: `npm run validate`

## References

- [MDN Web Docs](https://developer.mozilla.org/)
- [JavaScript.info](https://javascript.info/)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/javascriptguide.html)
- [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)
