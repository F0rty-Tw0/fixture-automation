import type { AiTool } from './ai-fixtures.type.ts';

/** Claude Code model aliases; the CLI also accepts full model identifiers. */
const CLAUDE_MODELS = ['fable', 'opus', 'sonnet', 'haiku'];

/** Codex fallback only. The live list comes from the harness cache; see `discoverModels`. */
const CODEX_MODELS = ['gpt-6-astra', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.5', 'gpt-5.3-codex-spark'];

// unverified: CLI not installed on the authoring machine
const GEMINI_MODELS = ['gemini-3-pro', 'gemini-3-flash', 'gemini-2.5-pro', 'gemini-2.5-flash'];

// unverified: CLI not installed on the authoring machine
const COPILOT_MODELS = ['claude-sonnet-4.5', 'claude-haiku-4.5', 'gpt-5', 'gpt-5-mini', 'gemini-2.5-pro'];

// unverified: CLI not installed on the authoring machine
// Deliberately empty: the `agy` argument vector has no model switch, so every slug would be rejected.
const ANTIGRAVITY_MODELS: string[] = [];

/** Fallback model lists per harness, used whenever live discovery is unavailable. */
export const CURATED_MODELS: Record<AiTool, string[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  antigravity: ANTIGRAVITY_MODELS,
  copilot: COPILOT_MODELS,
  gemini: GEMINI_MODELS
};
