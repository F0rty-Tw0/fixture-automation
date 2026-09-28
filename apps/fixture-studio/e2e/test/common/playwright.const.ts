import { fileURLToPath } from 'node:url';

/** e2e runs its own servers on ports next to the dev ones, so a running `pnpm studio` never answers a test. */
export const UI_PORT = 4300;

export const API_PORT = 3334;

export const BASE_URL = `http://127.0.0.1:${UI_PORT}`;

export const API_ROUTE_PATTERN = '**/api/**';

export const SPECS_ROUTE = '**/api/specs';

export const GENERATE_ROUTE = '**/api/specs/*/generate';

export const DIFF_ROUTE = '**/api/specs/*/diff';

export const MERGE_ROUTE = '**/api/specs/*/merge';

export const AI_PROMPT_ROUTE = '**/api/specs/*/ai-prompt';

export const AI_FILL_ROUTE = '**/api/specs/*/ai-fill';

/** The models route carries `?tool=`, so the pattern runs past the path. */
export const CLI_MODELS_ROUTE = '**/api/ai/cli/models**';

export const CLI_TOOLS_ROUTE = '**/api/ai/cli/tools';

export const WORKSPACE_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

export const SAMPLE_SPEC_PATH = fileURLToPath(
  new URL('../../../../fixture-studio-api/src/test/fixtures/studio/spec.json', import.meta.url)
);

export const SCREENSHOT_DIR = fileURLToPath(new URL('../../screenshots/', import.meta.url));

export const REPORT_DIR = fileURLToPath(new URL('../../../../../dist/.playwright/fixture-studio/report/', import.meta.url));

export const RESULTS_DIR = fileURLToPath(new URL('../../../../../dist/.playwright/fixture-studio/test-results/', import.meta.url));

/**
 * The first `.ts` fixture read lazy-loads the TypeScript compiler, a multi-megabyte chunk in dev mode that took
 * almost 4s to download alone under parallel workers; assertions right after that read wait this long instead of 5s.
 */
export const TS_READER_TIMEOUT_MS = 20_000;
