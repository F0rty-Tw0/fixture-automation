import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';

assert.ok(process.argv.includes('--safe-mode'));
const input = createInterface({ input: process.stdin });

for await (const line of input) {
  const request = JSON.parse(line);
  assert.equal(request.type, 'control_request');
  assert.equal(request.request.subtype, 'initialize');
  const response = {
    subtype: 'success',
    request_id: request.request_id,
    response: { models: [{ value: 'new-claude-model' }, { value: 'custom-alias' }] }
  };
  process.stdout.write('{"type":"system","subtype":"init"}\n');
  process.stdout.write(`${JSON.stringify({ type: 'control_response', response })}\n`);
}
