import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach, expect } from 'vitest';

// Matchers DOM (toBeInTheDocument, toHaveAccessibleDescription…) branchés sur l'expect de Vitest.
expect.extend(matchers);

afterEach(() => {
  cleanup();
});
