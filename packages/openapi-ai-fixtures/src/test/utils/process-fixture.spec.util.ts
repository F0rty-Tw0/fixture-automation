import { fileURLToPath } from 'node:url';

export const processFixture = (fixture: string, file: string): string => {
  const relativePath = `../fixtures/${fixture}/${file}`;
  const fixtureUrl = new URL(relativePath, import.meta.url);

  return fileURLToPath(fixtureUrl);
};
