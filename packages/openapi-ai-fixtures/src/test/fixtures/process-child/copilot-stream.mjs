import { access } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

let releaseFile = '';
for await (const chunk of process.stdin) releaseFile += chunk;
const args = process.argv.slice(2);
const streaming = args.includes('--stream=on');
const prefix = '{"id":';

if (!args.includes('--silent')) process.stdout.write('Copilot response:\n');
process.stderr.write('Controlled Copilot diagnostic\n');
if (streaming) process.stdout.write(prefix);

while (true) {
  try {
    await access(releaseFile);
    break;
  } catch {
    await setTimeout(10);
  }
}

if (!streaming) process.stdout.write(prefix);
process.stdout.write('"café"}');
