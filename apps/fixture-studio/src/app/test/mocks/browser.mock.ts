import type { Mock } from 'vitest';
import { vi } from 'vitest';

export const clipboardMock = (): Clipboard => {
  const clipboard: Clipboard = {
    read: vi.fn(),
    readText: vi.fn(),
    write: vi.fn(),
    writeText: vi.fn(),
    addEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    removeEventListener: vi.fn()
  };

  return clipboard;
};

export const languageModelSessionMock = (): LanguageModelSession => {
  const session: LanguageModelSession = { promptStreaming: vi.fn(), destroy: vi.fn() };

  return session;
};

export const languageModelMock = (): LanguageModelFactory => {
  const factory: LanguageModelFactory = { availability: vi.fn(), create: vi.fn() };

  return factory;
};

/** jsdom does no layout and has no `scrollIntoView`; this stands in on every element and records the calls. */
export const scrollIntoViewMock = (): Mock<Element['scrollIntoView']> => {
  const scrollIntoView = vi.fn<Element['scrollIntoView']>();

  Element.prototype.scrollIntoView = scrollIntoView;

  return scrollIntoView;
};

/** jsdom lays nothing out and gives `Range` no rects; CodeMirror measures text through them when it scrolls to a change. */
export const rangeRectsMock = (): void => {
  const box = document.createElement('div');

  Range.prototype.getClientRects = (): DOMRectList => box.getClientRects();
  Range.prototype.getBoundingClientRect = (): DOMRect => box.getBoundingClientRect();
};
