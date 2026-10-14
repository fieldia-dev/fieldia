import { loadParts } from '@fieldia/viewer';
import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';

setupZonelessTestEnv();

// Every part (parts.ts in @fieldia/widgets) in before each file's tests, as a page has them once they have come.
beforeAll(() => loadParts());
