import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = Buffer.concat(chunks).toString('utf8');

if (args.includes('models')) {
  assert.deepEqual(args, ['--output-format', 'json', 'models']);
  assert.equal(input, '');
  process.stdout.write(
    JSON.stringify({
      status: 'SUCCESS',
      num_turns: 0,
      command: { name: 'models', data: { models: [{ id: 'new-agy-model', label: 'New Model' }] } }
    })
  );
} else {
  const modelFlag = args.indexOf('--model');
  assert.ok(modelFlag >= 0);
  assert.equal(args[modelFlag + 1], 'new-agy-model');
  assert.equal(JSON.parse(input).event, 'user');
  process.stdout.write(`${JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: '{"status":"open"}' } })}\n`);
}
