import type { AgentJson } from '../../agent-provider/common/agent-provider.type.ts';

type AgentAttempt = {
  readonly response: string;
  readonly attempt: 1 | 2;
  /** What the caller's check still rejects in `value`; `undefined` when it passed or nothing checked it. */
  readonly problem?: string | undefined;
};

export type AgentFixture = AgentAttempt & AgentJson;

/** Why a parsed answer is unusable, or `undefined` when it is fine; `parsed` says whether it was dug out of prose. */
export type FixtureCheck = (value: unknown, parsed: AgentJson) => Promise<string | undefined>;

export type FillJudge = {
  readonly check: FixtureCheck;
  /** Every parsed value expanded to a concrete fill, each answer's alternatives before its chosen value, in attempt order. */
  readonly candidates: unknown[];
  /** The value the last passing `check` accepted: the chosen one, or an alternative from the same answer. */
  readonly accepted: () => unknown;
};
