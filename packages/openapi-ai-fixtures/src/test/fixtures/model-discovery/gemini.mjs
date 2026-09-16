import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { createInterface } from 'node:readline';

const args = process.argv.slice(2);

assert.equal(args.length, 5);
assert.deepEqual(args.slice(0, 4), ['--acp', '--extensions', 'none', '--allowed-mcp-server-names']);
assert.equal(args[4], '');
assert.equal(process.env.NO_BROWSER, 'true');
assert.equal(process.env.GEMINI_CLI_TRUST_WORKSPACE, 'true');
assert.notEqual(process.env.GEMINI_RESTRICTED_MODE, 'true');
assert.equal(process.env.GEMINI_SANDBOX, undefined);
assert.equal(isAbsolute(process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH), true);
assert.equal(isAbsolute(process.env.GEMINI_CLI_SYSTEM_DEFAULTS_PATH), true);
assert.equal(process.env.GEMINI_CLI_SYSTEM_SETTINGS_PATH.endsWith('gemini-system-safe.json'), true);
assert.equal(process.env.GEMINI_CLI_SYSTEM_DEFAULTS_PATH.endsWith('gemini-system-defaults.json'), true);

const settings = JSON.parse(await readFile(join(process.cwd(), '.gemini/settings.json'), 'utf8'));

assert.deepEqual(settings, {
  experimental: {
    autoMemory: false,
    enableAgents: false
  },
  general: {
    enableAutoUpdate: false,
    enableAutoUpdateNotification: false
  },
  hooksConfig: {
    enabled: false
  },
  skills: {
    enabled: false
  },
  tools: {
    core: [],
    discoveryCommand: ''
  }
});

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
          agentInfo: { name: 'gemini-cli', version: '0.60.0' },
          protocolVersion: 1
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
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: '2.0',
        id: request.id,
        result: {
          models: {
            availableModels: [
              { modelId: 'provider-model', name: 'Provider model' },
              { modelId: 'provider-auto', name: 'Automatic selection' }
            ],
            currentModelId: 'provider-auto'
          },
          sessionId: 'discovery-session'
        }
      })}\n`
    );
    continue;
  }

  throw new Error(`Unexpected Gemini ACP request: ${request.method}`);
}

assert.equal(requests, 2);
