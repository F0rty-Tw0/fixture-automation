import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import { OnDeviceAi } from './on-device-ai.service.ts';
import type { AiAvailability, ChromeAiProvider } from '../common/ai-fill.type.ts';
import { AiSettingsStore } from '../data-access/ai-settings.store.ts';
import { CHROME_AI_PROVIDER } from '../data-access/chrome-built-in-ai.provider.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';
import { settle } from '../test/utils/studio-http.spec.util.ts';

describe('FEATURE: on-device AI', (): void => {
  let chrome: ChromeAiProvider;

  const setUp = async (availability: AiAvailability): Promise<OnDeviceAi> => {
    vi.spyOn(chrome, 'availability').mockResolvedValue(availability);

    const onDevice = TestBed.inject(OnDeviceAi);

    await settle();

    return onDevice;
  };

  beforeEach((): void => {
    localStorage.clear();

    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: studioEngineMock() };

    TestBed.configureTestingModule({ providers: [provideFixtureWorkbench(), engineProvider] });
    chrome = TestBed.inject(CHROME_AI_PROVIDER);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it('GIVEN Chrome has not answered yet WHEN read THEN the model is being checked', (): void => {
    vi.spyOn(chrome, 'availability').mockReturnValue(new Promise<AiAvailability>((): undefined => undefined));

    const onDevice = TestBed.inject(OnDeviceAi);

    expect(onDevice.state()).toBe('checking');
  });

  describe('GIVEN an opt-in and a model that is not downloaded yet', (): void => {
    let onDevice: OnDeviceAi;

    beforeEach(async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);
      onDevice = await setUp('downloadable');
    });

    it('WHEN read THEN the on-device provider waits for its download', (): void => {
      expect(onDevice.provider()).toBe('chrome');
      expect(onDevice.state()).toBe('needs-download');
      expect(onDevice.isAwaitingModel()).toBe(true);
    });

    it('WHEN the user downloads it THEN shows it downloading, then asks Chrome again and is ready', async (): Promise<void> => {
      let finish: () => void = (): undefined => undefined;
      const pendingDownload = async (): Promise<void> => {
        return new Promise<void>((resolve) => {
          finish = resolve;
        });
      };

      vi.spyOn(chrome, 'download').mockImplementation(pendingDownload);
      onDevice.downloadModel();
      TestBed.tick();

      expect(onDevice.state()).toBe('downloading');

      vi.mocked(chrome.availability).mockResolvedValue('available');
      finish();
      await settle();

      expect(onDevice.state()).toBe('ready');
      expect(onDevice.isAwaitingModel()).toBe(false);
    });

    it('WHEN the download fails THEN exposes why', async (): Promise<void> => {
      vi.spyOn(chrome, 'download').mockRejectedValue(new Error('No space left for the model.'));
      onDevice.downloadModel();
      await settle();

      expect(onDevice.downloadError()?.message).toBe('No space left for the model.');
    });

    it('WHEN Chrome is asked again THEN takes its new answer', async (): Promise<void> => {
      vi.mocked(chrome.availability).mockResolvedValue('available');

      onDevice.recheckAvailability();
      await settle();

      expect(onDevice.state()).toBe('ready');
    });
  });

  describe('GIVEN Chrome cannot run the model here', (): void => {
    it('WHEN opted in THEN the local CLI fills and nothing waits for a model', async (): Promise<void> => {
      TestBed.inject(AiSettingsStore).setChromeOptIn(true);

      const onDevice = await setUp('unavailable');

      expect(onDevice.provider()).toBe('cli');
      expect(onDevice.state()).toBe('unavailable');
      expect(onDevice.isAwaitingModel()).toBe(false);
    });
  });

  it('GIVEN no opt-in WHEN the user opts in THEN it is remembered and the provider follows', async (): Promise<void> => {
    const onDevice = await setUp('available');

    onDevice.setChromeOptIn(true);

    expect(onDevice.isChromeOptedIn()).toBe(true);
    expect(onDevice.provider()).toBe('chrome');
  });
});
