import { readFile } from 'node:fs/promises';

import type { Download } from '@playwright/test';

export const downloadText = async (download: Download): Promise<string> => {
  const path = await download.path();

  return readFile(path, 'utf8');
};
