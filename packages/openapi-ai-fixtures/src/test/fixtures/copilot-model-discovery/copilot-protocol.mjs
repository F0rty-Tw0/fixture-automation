import assert from 'node:assert/strict';

const mode = process.env['COPILOT_MODEL_DISCOVERY_FIXTURE_MODE'];
const headerDelimiter = Buffer.from('\r\n\r\n');
let input = Buffer.alloc(0);
let phase = 'connect';

assert.ok(process.argv.includes('--headless'));
assert.ok(process.argv.includes('--stdio'));
assert.ok(process.argv.includes('--no-auto-update'));
assert.ok(process.argv.includes('--log-level'));
assert.ok(process.argv.includes('none'));

const framed = (message) => {
  const body = JSON.stringify(message);
  const contentLength = Buffer.byteLength(body, 'utf8');
  const header = `Content-Length: ${contentLength}\r\n\r\n`;

  return Buffer.from(`${header}${body}`, 'utf8');
};

const writeOutput = (output) => {
  const headerFragmentEnd = 7;
  const modelIdentifier = Buffer.from('模', 'utf8');
  const modelIdentifierStart = output.indexOf(modelIdentifier);

  process.stdout.write(output.subarray(0, headerFragmentEnd));

  if (modelIdentifierStart < 0) {
    process.stdout.write(output.subarray(headerFragmentEnd));

    return;
  }

  process.stdout.write(output.subarray(headerFragmentEnd, modelIdentifierStart + 1));
  process.stdout.write(output.subarray(modelIdentifierStart + 1));
};

const response = (id, result) => {
  const notification = { jsonrpc: '2.0', method: 'runtime.notice', params: {} };
  const message = { jsonrpc: '2.0', id, result };
  const notificationOutput = framed(notification);
  const responseOutput = framed(message);
  const output = Buffer.concat([notificationOutput, responseOutput]);

  writeOutput(output);
};

const error = (id, code, detail) => {
  const error = { code, message: detail };
  const message = { jsonrpc: '2.0', id, error };

  process.stdout.write(framed(message));
};

const models = [
  { id: 'opaque:provider/模型?deployment=production' },
  { id: 'disabled-model', policy: { state: 'disabled', terms: 'disabled for this account' } },
  { id: 'unconfigured-model', policy: { state: 'unconfigured', terms: 'pending configuration' } }
];

if (mode === 'unknown-policy') models.push({ id: 'blocked-model', policy: { state: 'blocked' } });

const handle = (request) => {
  assert.equal(request.jsonrpc, '2.0');

  if (phase === 'connect') {
    const configuredToken = process.env['COPILOT_CONNECTION_TOKEN'];
    const includesToken = typeof request.params.token === 'string';

    assert.equal(request.method, 'connect');
    assert.equal(includesToken, configuredToken !== undefined);

    phase = 'models';
    const protocolVersion = mode === 'unsupported-protocol' ? 4 : 3;
    response(request.id, { ok: true, protocolVersion, version: 'fixture' });

    return;
  }

  if (phase === 'models') {
    assert.equal(request.method, 'models.list');
    assert.deepEqual(request.params, {});

    if (mode === 'auth-error') {
      phase = 'wait';
      error(request.id, -32000, 'Copilot authentication is required');

      return;
    }

    if (mode === 'malformed') {
      phase = 'wait';
      response(request.id, { models: [{ id: '' }] });

      return;
    }

    phase = 'shutdown';
    response(request.id, { models });

    return;
  }

  if (phase === 'shutdown') {
    assert.equal(request.method, 'runtime.shutdown');
    assert.deepEqual(request.params, {});
    phase = 'wait';
    response(request.id, {});

    return;
  }

  throw new Error(`Unexpected request after ${phase}: ${request.method}`);
};

const drain = () => {
  while (true) {
    const headerEnd = input.indexOf(headerDelimiter);

    if (headerEnd < 0) return;

    const header = input.subarray(0, headerEnd).toString('ascii');
    const match = /^Content-Length: (\d+)$/m.exec(header);

    assert.notEqual(match, null);

    const contentLength = Number(match[1]);
    const bodyStart = headerEnd + headerDelimiter.length;
    const frameEnd = bodyStart + contentLength;

    if (input.length < frameEnd) return;

    const body = input.subarray(bodyStart, frameEnd).toString('utf8');
    const request = JSON.parse(body);

    input = input.subarray(frameEnd);
    handle(request);
  }
};

process.stdin.on('data', (chunk) => {
  input = Buffer.concat([input, chunk]);
  drain();
});

await new Promise(() => {});
