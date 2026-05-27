// Re-export the shim's `window.__TEST__` global declaration for tests.
// The declaration in src/test/e2e/shims/state.ts only takes effect inside
// modules that import it; this file makes it ambient for the test suite.

import "../../src/test/e2e/shims/state";
