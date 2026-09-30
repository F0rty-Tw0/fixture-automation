import type { AiTool } from '../../shared/ai-tool/common/ai-fixtures.type.ts';

/**
 * Whether a missing-field fill stages the baseline as `baseline.json` for the tool to read by default.
 * Codex stays `false` for good: its read-only sandbox cannot confine reads to the scratch directory, so enabling its
 * shell tool would let it read the whole disk. Gemini, Copilot and Antigravity are wired but stay `false` until the
 * live check (`ai-missing-fixtures.live.spec.ts`) passes on a machine that has them installed.
 */
export const FILE_MODE_TOOLS: Record<AiTool, boolean> = {
  claude: true,
  codex: false,
  gemini: false,
  copilot: false,
  antigravity: false
};

/** `OPENAPI_AI_READ_FILES` values, trimmed and lower-cased, that turn file mode off. */
export const READ_FILES_OFF_VALUES: string[] = ['0', 'false', 'off', 'no'];

export const CODEX_DIGEST_ONLY =
  'Codex reads no files: its read-only sandbox cannot confine reads to the scratch directory, so it gets the digest only.\n';
