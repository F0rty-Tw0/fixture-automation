import type { AiDownloadOptions } from '../common/ai-fill.type.ts';

const isDownloadEvent = (event: Event): event is LanguageModelDownloadEvent => {
  return 'loaded' in event && typeof event.loaded === 'number';
};

/** A `create` monitor that reports each `downloadprogress` ratio; events without one are ignored. */
export const downloadMonitor = (onDownload: (ratio: number) => void): ((target: LanguageModelMonitor) => void) => {
  const reportDownload = (event: Event): void => {
    if (isDownloadEvent(event)) onDownload(event.loaded);
  };

  const monitor = (target: LanguageModelMonitor): void => {
    target.addEventListener('downloadprogress', reportDownload);
  };

  return monitor;
};

/**
 * Downloads the on-device model by creating a session and dropping it. Call from a click: Chrome only starts a
 * download with the user activation a click gives.
 */
export const downloadModel = async (factory: LanguageModelFactory, options: AiDownloadOptions): Promise<void> => {
  const monitor = downloadMonitor(options.onDownload);
  const session = await factory.create({ monitor, signal: options.signal });

  session.destroy();
};
