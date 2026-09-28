import { beforeEach, describe, expect, it, vi } from 'vitest';

import { downloadModel, downloadMonitor } from './chrome-ai-download.client.ts';
import type { AiDownloadOptions } from '../common/ai-fill.type.ts';
import { languageModelMock, languageModelSessionMock } from '../test/mocks/browser.mock.ts';

const HALF = { loaded: 0.5 };

const progressEvent = (): Event => Object.assign(new Event('downloadprogress'), HALF);

describe('FEATURE: on-device model download', (): void => {
  let ratios: number[];

  beforeEach((): void => {
    ratios = [];
  });

  describe('GIVEN a download monitor', (): void => {
    it('WHEN Chrome reports a ratio THEN it is passed on', (): void => {
      const target = new EventTarget();
      const monitor = downloadMonitor((ratio): number => ratios.push(ratio));

      monitor(target);
      target.dispatchEvent(progressEvent());

      expect(ratios).toStrictEqual([0.5]);
    });

    it('WHEN an event carries no ratio THEN it is ignored', (): void => {
      const target = new EventTarget();
      const monitor = downloadMonitor((ratio): number => ratios.push(ratio));

      monitor(target);
      target.dispatchEvent(new Event('downloadprogress'));

      expect(ratios).toStrictEqual([]);
    });
  });

  describe('GIVEN a model that downloads while its session is created', (): void => {
    let factory: LanguageModelFactory;
    let session: LanguageModelSession;
    let options: AiDownloadOptions;

    beforeEach((): void => {
      factory = languageModelMock();
      session = languageModelSessionMock();
      options = { signal: new AbortController().signal, onDownload: (ratio): number => ratios.push(ratio) };

      const createSession = async (createOptions?: LanguageModelCreateOptions): Promise<LanguageModelSession> => {
        const monitor = new EventTarget();

        createOptions?.monitor?.(monitor);
        monitor.dispatchEvent(progressEvent());

        return Promise.resolve(session);
      };

      vi.mocked(factory.create).mockImplementation(createSession);
    });

    it('WHEN downloaded THEN reports the progress', async (): Promise<void> => {
      await downloadModel(factory, options);

      expect(ratios).toStrictEqual([0.5]);
    });

    it('WHEN downloaded THEN drops the session it only created to download', async (): Promise<void> => {
      await downloadModel(factory, options);

      expect(factory.create).toHaveBeenCalledWith(expect.objectContaining({ signal: options.signal }));
      expect(session.destroy).toHaveBeenCalledTimes(1);
    });
  });
});
