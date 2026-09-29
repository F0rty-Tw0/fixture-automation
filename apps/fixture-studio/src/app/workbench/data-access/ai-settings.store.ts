import { Service, signal } from '@angular/core';
import type { Signal } from '@angular/core';

import { AI_OPT_IN_STORAGE_KEY } from '../common/ai-fill.const.ts';

/** Storage can be missing or throw (private mode, blocked site data); the setting then lives for the session only. */
const readOptIn = (): boolean => {
  try {
    return globalThis.localStorage.getItem(AI_OPT_IN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const writeOptIn = (isOptedIn: boolean): void => {
  try {
    globalThis.localStorage.setItem(AI_OPT_IN_STORAGE_KEY, String(isOptedIn));
  } catch {
    // The in-memory value still applies for this session.
  }
};

/** User-level AI settings, remembered per browser. On-device Chrome AI is opt-in: off until the user turns it on. */
@Service()
export class AiSettingsStore {
  private readonly optIn = signal(readOptIn());

  public readonly isChromeOptedIn: Signal<boolean> = this.optIn.asReadonly();

  public setChromeOptIn(isOptedIn: boolean): void {
    this.optIn.set(isOptedIn);
    writeOptIn(isOptedIn);
  }
}
