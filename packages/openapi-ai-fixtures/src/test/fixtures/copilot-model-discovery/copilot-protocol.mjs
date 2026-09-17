import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import { createInterface } from 'node:readline';

const mode = process.env['COPILOT_MODEL_DISCOVERY_FIXTURE_MODE'];

assert.ok(process.argv.includes('--acp'));
assert.ok(process.argv.includes('--no-auto-update'));
assert.equal(process.argv.includes('--headless'), false);
assert.equal(process.argv.includes('--stdio'), false);

const CONFIG_OPTIONS_RESULT = {
  sessionId: 'sess_fixture',
  modes: { currentModeId: 'agent', availableModes: [{ id: 'agent', name: 'Agent' }] },
  configOptions: [
    {
      id: 'mode',
      name: 'Mode',
      category: 'mode',
      type: 'select',
      currentValue: 'agent',
      options: [{ value: 'agent', name: 'Agent' }]
    },
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: 'gpt-fixture',
      groups: [
        { name: 'OpenAI', options: [{ value: 'gpt-fixture', name: 'GPT fixture' }] },
        {
          name: 'Anthropic',
          options: [
            { value: 'opaque:provider/模型?deployment=production', name: 'Unicode' },
            { value: 'gpt-fixture', name: 'Duplicate' }
          ]
        }
      ]
    }
  ]
};

const LEGACY_MODELS_RESULT = {
  sessionId: 'sess_fixture',
  models: {
    availableModels: [
      { modelId: 'legacy-a', name: 'A' },
      { modelId: 'legacy-b', name: 'B' }
    ],
    currentModelId: 'legacy-a'
  }
};

const MALFORMED_RESULT = {
  sessionId: 'sess_fixture',
  configOptions: [
    {
      id: 'model',
      name: 'Model',
      category: 'model',
      type: 'select',
      currentValue: '',
      options: [{ value: '' }]
    }
  ]
};

// Split mid-line so the client has to reassemble the response from two stdout chunks.
const writeSplit = (line) => {
  const splitAt = 40;

  process.stdout.write(line.slice(0, splitAt));
  process.stdout.write(line.slice(splitAt));
};

const sessionResult = () => {
  if (mode === 'legacy-models') return LEGACY_MODELS_RESULT;

  if (mode === 'malformed') return MALFORMED_RESULT;

  return CONFIG_OPTIONS_RESULT;
};

const input = createInterface({ input: process.stdin });
let requests = 0;

for await (const line of input) {
  const request = JSON.parse(line);

  requests += 1;

  if (request.method === 'initialize') {
    assert.equal(request.jsonrpc, '2.0');
    assert.equal(request.id, 1);
    assert.deepEqual(request.params, {
      clientCapabilities: {},
      protocolVersion: 1
    });
    process.stdout.write('{"jsonrpc":"2.0","method":"session/update","params":{}}\n');
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: mode === 'unsupported-protocol' ? 2 : 1,
          agentCapabilities: {},
          authMethods: [],
          agentInfo: { name: 'copilot', version: 'fixture' }
        }
      })}\n`
    );
    continue;
  }

  if (request.method === 'session/new') {
    assert.equal(request.jsonrpc, '2.0');
    assert.equal(request.id, 2);
    assert.equal(isAbsolute(request.params.cwd), true);
    assert.equal(request.params.cwd, process.cwd());
    assert.deepEqual(request.params.mcpServers, []);

    if (mode === 'auth-error') {
      process.stdout.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: request.id,
          error: { code: -32000, message: 'Copilot authentication is required', data: { authMethods: [] } }
        })}\n`
      );
      continue;
    }

    writeSplit(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: sessionResult()
      })}\n`
    );
    continue;
  }

  throw new Error(`Unexpected Copilot ACP request: ${request.method}`);
}

// The client throws in these modes, so the harness kills the process before both requests arrive.
const isFailureMode = mode === 'auth-error' || mode === 'malformed' || mode === 'unsupported-protocol';

if (!isFailureMode) assert.equal(requests, 2);
