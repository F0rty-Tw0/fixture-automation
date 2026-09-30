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
