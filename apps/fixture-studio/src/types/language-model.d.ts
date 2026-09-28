// Minimal typing of Chrome's built-in Prompt API (https://developer.chrome.com/docs/ai/prompt-api);
// only the members Fixture Studio calls. Global, like the API itself.

declare global {
  type LanguageModelAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable';

  type LanguageModelDownloadProgress = {
    /** Fraction downloaded, 0 to 1. */
    readonly loaded: number;
  };

  type LanguageModelDownloadEvent = Event & LanguageModelDownloadProgress;

  /** Chrome's `CreateMonitor`: an event target that fires `downloadprogress` events. */
  type LanguageModelMonitor = EventTarget;

  type LanguageModelPrompt = {
    readonly role: 'assistant' | 'system' | 'user';
    readonly content: string;
  };

  type LanguageModelCreateOptions = {
    readonly initialPrompts?: LanguageModelPrompt[];
    readonly monitor?: (monitor: LanguageModelMonitor) => void;
    readonly signal?: AbortSignal;
  };

  type LanguageModelPromptOptions = {
    readonly responseConstraint?: Record<string, unknown>;
    /** Constrains the answer without also adding the schema to the prompt's input. */
    readonly omitResponseConstraintInput?: boolean;
    readonly signal?: AbortSignal;
  };

  type LanguageModelCloneOptions = {
    readonly signal?: AbortSignal;
  };

  /** The context members are optional: Chrome versions before them, and test stubs, don't have them. */
  type LanguageModelSession = {
    /** Tokens the session can hold, prompts and answers included. */
    readonly contextWindow?: number;
    /** Tokens already used, the system prompt included. */
    readonly contextUsage?: number;
    measureContextUsage?(input: string, options?: LanguageModelCloneOptions): Promise<number>;
    clone?(options?: LanguageModelCloneOptions): Promise<LanguageModelSession>;
    promptStreaming(input: string, options?: LanguageModelPromptOptions): ReadableStream<string>;
    destroy(): void;
  };

  type LanguageModelFactory = {
    availability(): Promise<LanguageModelAvailability>;
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>;
  };

  // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors Chrome's global of that name.
  var LanguageModel: LanguageModelFactory | undefined;
}

export {};
