export type AgentFixture = {
  readonly value: unknown;
  readonly response: string;
  readonly attempt: 1 | 2;
  /** What the caller's check still rejects in `value`; `undefined` when it passed or nothing checked it. */
  readonly problem?: string | undefined;
};

/** Why a parsed answer is unusable, or `undefined` when it is fine. */
export type FixtureCheck = (value: unknown) => Promise<string | undefined>;
