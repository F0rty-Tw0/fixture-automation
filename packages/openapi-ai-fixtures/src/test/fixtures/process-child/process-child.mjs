import { spawn } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const [mode, ...args] = process.argv.slice(2);

const inputText = async () => {
  const chunks = [];

  for await (const chunk of process.stdin) chunks.push(chunk);

  return Buffer.concat(chunks).toString('utf8');
};

if (mode === 'echo') {
  const input = await inputText();
  const file = await readFile('nested/context.json', 'utf8');
  const hasRemovedValue = process.env.PROCESS_FIXTURE_REMOVED !== undefined;
  const result = {
    args,
    input,
    file,
    envValue: process.env.PROCESS_FIXTURE_VALUE,
    hasRemovedValue
  };

  process.stdout.write(JSON.stringify(result));
} else if (mode === 'write-cwd') {
  await writeFile(args[0], process.cwd());
  process.stdout.write('complete');
} else if (mode === 'nonzero') {
  if (args[0]) await writeFile(args[0], process.cwd());

  process.stderr.write('fixture child failed\n');
  process.exitCode = 23;
} else if (mode === 'wait') {
  if (args[0]) await writeFile(args[0], process.cwd());

  setInterval(() => undefined, 1_000);
} else if (mode === 'tree' || mode === 'resistant-tree') {
  await writeFile(args[0], process.cwd());

  const grandchild = fileURLToPath(new URL('process-grandchild.mjs', import.meta.url));
  const grandchildArgs = mode === 'resistant-tree' ? [grandchild, args[1], '--ignore-term', args[2]] : [grandchild, args[1]];
  spawn(process.execPath, grandchildArgs, {
    detached: false,
    stdio: 'ignore',
    windowsHide: true
  });
  setInterval(() => undefined, 1_000);
} else if (mode === 'split-utf8') {
  process.stdout.write('{"name":"');
  process.stdout.write(Buffer.from([0xc3]));
  await new Promise((resolve) => setTimeout(resolve, 25));
  process.stdout.write(Buffer.from([0xa9]));
  process.stdout.write('"}');
} else if (mode === 'overflow') {
  process.stdout.write(Buffer.alloc(8 * 1024 * 1024 + 1, 'x'));
  setInterval(() => undefined, 1_000);
} else {
  process.stderr.write(`unknown mode: ${mode}\n`);
  process.exitCode = 24;
}
