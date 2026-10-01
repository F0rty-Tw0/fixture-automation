import { signal } from '@angular/core';

import { vi } from 'vitest';

import type { ExportNaming } from '../../common/document-view.type.ts';

/** Remembers the subdirectory in memory, as the real naming does in storage; `fileName` answers nothing until a spec says so. */
export const exportNamingMock = (): ExportNaming => {
  const subdirectory = signal('');
  const remember = (value: string): void => subdirectory.set(value);
  const naming: ExportNaming = { subdirectory, rememberSubdirectory: vi.fn(remember), fileName: vi.fn() };

  return naming;
};
