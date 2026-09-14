export type InputSpec = { readonly label: string; readonly description: string; readonly example: string };

/** One line of operator input; injected so prompting is testable. */
export type Question = (prompt: string) => Promise<string>;

export type Inputs = {
  /** Given value, else prompt; no terminal → throw FixtureError(usage, fix). */
  readonly required: (value: string | undefined, input: InputSpec, usage: string, fix?: string) => Promise<string>;
  /** Given value, else prompt only when a required input was already prompted; Enter/no terminal → undefined. */
  readonly optional: (value: string | undefined, input: InputSpec) => Promise<string | undefined>;
  /** Boolean flag, same gate as `optional`; y/yes → true. */
  readonly flag: (value: boolean | undefined, input: InputSpec) => Promise<boolean>;
};
