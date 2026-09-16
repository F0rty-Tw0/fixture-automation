import { createInterface } from 'node:readline';

const input = createInterface({ input: process.stdin });
let stage = 0;

for await (const line of input) {
  if (stage === 0 && line === 'initialize') {
    process.stdout.write('rea');
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.stdout.write('dy\nnotification\n');
    stage = 1;
  } else if (stage === 1 && line === 'models') {
    process.stdout.write('model-from-provider\n');
    stage = 2;
  } else {
    process.exitCode = 2;
    break;
  }
}

if (stage !== 2) process.exitCode = 3;
