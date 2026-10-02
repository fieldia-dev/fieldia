import { existsSync } from 'node:fs';

/** Every framework demo the browser gates must drive. */
export const EXPECTED_VARIANTS = ['plain', 'react', 'vue', 'angular'];

/** The demos that were actually built. A missing one fails `variants.spec.ts`, never skips quietly. */
export const VARIANTS = EXPECTED_VARIANTS.filter((variant) => existsSync(`dist/demos/${variant}/index.html`));
