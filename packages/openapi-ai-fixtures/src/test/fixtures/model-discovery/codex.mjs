import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';

assert.ok(process.argv.includes('app-server'));
const input = createInterface({ input: process.stdin });
let initialized = false;
let acknowledged = false;

for await (const line of input) {
  const request = JSON.parse(line);
  let result;

  if (request.method === 'initialize') {
    assert.equal(initialized, false);
    initialized = true;
    result = { userAgent: 'fixture' };
  } else if (request.method === 'initialized') {
    assert.equal(initialized, true);
    acknowledged = true;
    continue;
  } else if (request.method === 'model/list') {
    assert.ok(acknowledged);
    assert.equal(request.params.includeHidden, false);
    if (request.params.cursor == null) {
      result = { data: [{ model: 'new-model-a' }, { model: 'hidden', hidden: true }], nextCursor: 'page-two' };
    } else {
      assert.equal(request.params.cursor, 'page-two');
      result = { data: [{ model: 'new-model-b' }, { model: 'new-model-a' }], nextCursor: null };
    }
  } else {
    throw new Error(`Unexpected request: ${request.method}`);
  }

  process.stdout.write('{"method":"notification"}\n');
  process.stdout.write(`${JSON.stringify({ id: request.id, result })}\n`);
}
