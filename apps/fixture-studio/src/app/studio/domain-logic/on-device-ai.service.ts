import { Service, computed, inject, resource } from '@angular/core';
import type { ResourceRef, Signal } from '@angular/core';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

import type { AiAvailability, AiProviderId, OnDeviceState } from '../common/ai-fill.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { AiSettingsStore } from '../data-access/ai-settings.store.ts';
import { CHROME_AI_PROVIDER } from '../data-access/chrome-built-in-ai.provider.ts';
import { chooseAiProvider, onDeviceState } from '../utils/ai-provider.util.ts';
import { toApiError } from '../utils/api-error.util.ts';

/**
 * The on-device model as the AI step offers it: the opt-in, what Chrome reports, and the download the user starts.
 * A fill never downloads the model; it waits until the model is ready.
 */
@Service({ autoProvided: false })
export class OnDeviceAi {
  private readonly store = inject(AiFillStore);
  private readonly settings = inject(AiSettingsStore);
  private readonly chrome = inject(CHROME_AI_PROVIDER);

  public readonly isChromeOptedIn: Signal<boolean> = this.settings.isChromeOptedIn;
  public readonly downloadRatio: Signal<number | undefined> = this.store.downloadRatio.asReadonly();
  public readonly isDownloading: Signal<boolean> = this.store.download.isLoading;
  public readonly downloadError: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.store.download.error()));

  /** Checked again after every on-device run or download: either changes the answer. */
  public readonly chromeAvailability: ResourceRef<AiAvailability | undefined> = resource({
    params: () => this.store.chromeRunsSettled(),
    loader: async (): Promise<AiAvailability> => this.chrome.availability()
  });

  /** On-device AI when the user opted in and Chrome can run it; the local CLI otherwise. */
  public readonly provider: Signal<AiProviderId> = computed(() => chooseAiProvider(this.isChromeOptedIn(), this.chromeAvailability.value()));

  public readonly state: Signal<OnDeviceState> = computed(() => onDeviceState(this.chromeAvailability.value(), this.isDownloading()));

  /** An opted-in user's provider is unknown until Chrome answers; nothing may start the CLI meanwhile. */
  public readonly isAwaitingChrome: Signal<boolean> = computed(() => {
    const isAvailabilityLoading = this.chromeAvailability.isLoading();

    return this.isChromeOptedIn() && isAvailabilityLoading;
  });

  /** The on-device provider is chosen but its model is not ready to prompt. */
  public readonly isAwaitingModel: Signal<boolean> = computed(() => {
    const isChrome = this.provider() === 'chrome';

    return isChrome && this.state() !== 'ready';
  });

  public setChromeOptIn(isOptedIn: boolean): void {
    this.settings.setChromeOptIn(isOptedIn);
  }

  /** Call from the "Download model" click: Chrome only starts a download with that click's user activation. */
  public downloadModel(): void {
    this.store.startDownload();
  }

  /** Asks Chrome again, e.g. once a download it started on its own may have finished. */
  public recheckAvailability(): void {
    this.chromeAvailability.reload();
  }
}
