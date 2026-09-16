import { appendFile, readFile, readdir } from 'node:fs/promises';

let input = '';
for await (const chunk of process.stdin) input += chunk;

if (input.includes('process failure')) {
  process.stderr.write('controlled tool failure');
  process.exit(7);
}

if (input.includes('malformed response')) {
  process.stdout.write('{not JSON');
  process.exit(0);
}

if (input.includes('invalid fixture JSON')) {
  const attemptsFile = new URL('attempts.jsonl', import.meta.url);
  await appendFile(attemptsFile, `${JSON.stringify({ input, args: process.argv.slice(2) })}\n`);
  const attempts = (await readFile(attemptsFile, 'utf8')).trim().split('\n').length;
  if (attempts === 2) {
    const repair = JSON.parse(input);
    const validRepair =
      repair.invalidResponse === '\r\n{"status": \t' &&
      typeof repair.parseError === 'string' &&
      repair.parseError.length > 0 &&
      typeof repair.request === 'string' &&
      repair.request.includes('invalid fixture JSON');
    const files = await readdir(new URL('.', import.meta.url));
    let preserved = false;
    for (const file of files) {
      if (!file.includes('.failed-attempt-1')) continue;
      if ((await readFile(new URL(file, import.meta.url), 'utf8')) === repair.invalidResponse) preserved = true;
    }
    if (!validRepair || !preserved) {
      process.stderr.write('repair must receive the original response, parser diagnostic, and request after saving the response');
      process.exit(8);
    }
  }
  const malformed = attempts === 1 ? '\r\n{"status": \t' : '{"status":"open",}\n';
  if (attempts === 1 || !input.includes('recover invalid fixture JSON')) {
    process.stdout.write(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: malformed }));
    process.exit(0);
  }
}

const fixture = { id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' };
const isDefaultMissingScenario = input.includes('Fill every missing field with realistic values coherent with the baseline');
if (input.includes('missing-mode') || isDefaultMissingScenario) {
  let filled = { status: 'open' };
  if (input.includes('missing-mode invalid')) filled = { status: 'paid' };
  if (isDefaultMissingScenario) filled = { status: 'draft' };
  process.stdout.write(
    JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: JSON.stringify(filled)
    })
  );
  process.exit(0);
}
if (input.includes('invalid enum')) fixture.status = 'paid';
if (input.includes('invalid amount')) fixture.amount_due = '4200';
if (input.includes('missing required')) delete fixture.id;

process.stdout.write(
  JSON.stringify({
    type: 'result',
    subtype: 'success',
    is_error: false,
    result: JSON.stringify(fixture)
  })
);
