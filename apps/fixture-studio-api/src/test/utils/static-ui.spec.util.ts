import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A temp folder holding a built UI in `ui/` (`index.html`, `app.js`) and a `{"sentinel":true}` `package.json` beside it that traversal must never reach; returns the folder, which the spec removes. */
export const staticUiFolder = async (): Promise<string> => {
  const prefix = join(tmpdir(), 'fixture-studio-ui-');
  const folder = await mkdtemp(prefix);
  const uiRoot = join(folder, 'ui');
  const indexPath = join(uiRoot, 'index.html');
  const scriptPath = join(uiRoot, 'app.js');
  const sentinelPath = join(folder, 'package.json');

  await mkdir(uiRoot);
  await writeFile(indexPath, '<p>ui</p>');
  await writeFile(scriptPath, 'console.log("ui");');
  await writeFile(sentinelPath, '{"sentinel":true}');

  return folder;
};
