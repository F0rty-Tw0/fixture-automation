import { writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const ignoresTerm = process.argv[3] === '--ignore-term';
const readyMarker = process.argv[4];

if (ignoresTerm) process.on('SIGTERM', () => undefined);
if (readyMarker !== undefined) await writeFile(readyMarker, 'grandchild started');

await setTimeout(3_000);
await writeFile(process.argv[2], 'grandchild survived');
