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
