/**
 * Vitest setup.
 *
 * Sets up fake-indexeddb so tests can use Dexie without
 * a real browser environment.
 */

import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
