import { describe, expect, it } from 'vitest';

import { modelNames, modelRpcRequest, modelRpcResult } from './model-discovery.util.ts';

const OPUS = { id: 'opus', hidden: false };
const SONNET = { id: 'sonnet' };
const HIDDEN = { id: 'secret', hidden: true };
const RESULT = { models: [OPUS] };

describe('FEATURE: model discovery protocol', (): void => {
  describe('GIVEN a provider model list', (): void => {
    it('WHEN every entry names a model THEN returns the names in order', (): void => {
      expect(modelNames([OPUS, SONNET], 'id')).toStrictEqual(['opus', 'sonnet']);
    });

    it('WHEN an entry is hidden THEN skips it', (): void => {
      expect(modelNames([HIDDEN, SONNET], 'id')).toStrictEqual(['sonnet']);
    });

    it('WHEN a name repeats THEN returns it once', (): void => {
      expect(modelNames([OPUS, OPUS], 'id')).toStrictEqual(['opus']);
    });

    it('WHEN a name carries whitespace THEN keeps it as sent', (): void => {
      expect(modelNames([{ id: ' opus ' }], 'id')).toStrictEqual([' opus ']);
    });

    it('WHEN the list is empty THEN returns no names', (): void => {
      expect(modelNames([], 'id')).toStrictEqual([]);
    });

    it('WHEN the key differs THEN reads the requested key', (): void => {
      expect(modelNames([{ name: 'flash' }], 'name')).toStrictEqual(['flash']);
    });
  });

  describe('GIVEN an invalid provider model list', (): void => {
    it('WHEN the value is not a list THEN throws', (): void => {
      expect((): unknown => modelNames(RESULT, 'id')).toThrow('Provider returned an invalid model list');
    });

    it('WHEN an entry is not an object THEN throws', (): void => {
      expect((): unknown => modelNames(['opus'], 'id')).toThrow('Provider returned an invalid model entry');
    });

    it.each([
      ['a missing identifier', { hidden: false }],
      ['a non-string identifier', { id: 1 }],
      ['a blank identifier', { id: '  ' }]
    ])('WHEN an entry has %s THEN throws', (_case: string, entry: unknown): void => {
      expect((): unknown => modelNames([entry], 'id')).toThrow('Provider returned a model without an identifier');
    });
  });

  describe('GIVEN request parameters', (): void => {
    it('WHEN building the request THEN emits one JSON-RPC line', (): void => {
      const expected = '{"jsonrpc":"2.0","id":3,"method":"models/list","params":{"cursor":null}}\n';

      expect(modelRpcRequest(3, 'models/list', { cursor: null })).toBe(expected);
    });
  });

  describe('GIVEN a JSON-RPC response line', (): void => {
    it('WHEN the id matches and the result is an object THEN returns the result', (): void => {
      const line = JSON.stringify({ jsonrpc: '2.0', id: 3, result: RESULT });

      expect(modelRpcResult(line, 3)).toStrictEqual(RESULT);
    });

    it('WHEN the id differs THEN returns undefined', (): void => {
      const line = JSON.stringify({ jsonrpc: '2.0', id: 4, result: RESULT });

      expect(modelRpcResult(line, 3)).toBeUndefined();
    });

    it('WHEN the error carries a message THEN throws that message', (): void => {
      const error = { code: -32601, message: 'Method not found' };
      const line = JSON.stringify({ jsonrpc: '2.0', id: 3, error });

      expect((): unknown => modelRpcResult(line, 3)).toThrow('Method not found');
    });

    it('WHEN the error has no string message THEN throws a generic rejection', (): void => {
      const error = { code: -32601 };
      const line = JSON.stringify({ jsonrpc: '2.0', id: 3, error });

      expect((): unknown => modelRpcResult(line, 3)).toThrow('Provider rejected model discovery');
    });

    it('WHEN the result is not an object THEN throws', (): void => {
      const line = JSON.stringify({ jsonrpc: '2.0', id: 3, result: [] });

      expect((): unknown => modelRpcResult(line, 3)).toThrow('Provider returned an invalid discovery result');
    });

    it('WHEN the message is not an object THEN throws', (): void => {
      expect((): unknown => modelRpcResult('[]', 3)).toThrow('Provider returned an invalid protocol message');
    });

    it('WHEN the line is not JSON THEN throws a syntax error', (): void => {
      expect((): unknown => modelRpcResult('{not JSON', 3)).toThrow(SyntaxError);
    });
  });
});
