import { isRecord } from '@fixture-automation/shared';

export const modelNames = (value: unknown, key: string): string[] => {
  const isList = Array.isArray(value);

  if (!isList) throw new Error('Provider returned an invalid model list');

  const entries: unknown[] = value;
  const names = new Set<string>();

  for (const entry of entries) {
    if (!isRecord(entry)) throw new Error('Provider returned an invalid model entry');

    if (entry['hidden'] === true) continue;

    const name = entry[key];

    if (typeof name !== 'string') throw new Error('Provider returned a model without an identifier');

    const trimmed = name.trim();

    if (trimmed.length === 0) throw new Error('Provider returned a model without an identifier');

    names.add(name);
  }

  return [...names];
};

export const modelRpcRequest = (id: number, method: string, params: Record<string, unknown>): string => {
  const request = { jsonrpc: '2.0', id, method, params };

  return `${JSON.stringify(request)}\n`;
};

export const modelRpcResult = (line: string, id: number): Record<string, unknown> | undefined => {
  const message: unknown = JSON.parse(line);

  if (!isRecord(message)) throw new Error('Provider returned an invalid protocol message');

  if (message['id'] !== id) return undefined;

  const error = message['error'];

  if (isRecord(error)) {
    const detail = error['message'];
    const reason = typeof detail === 'string' ? detail : 'Provider rejected model discovery';

    throw new Error(reason);
  }

  const result = message['result'];

  if (!isRecord(result)) throw new Error('Provider returned an invalid discovery result');

  return result;
};
