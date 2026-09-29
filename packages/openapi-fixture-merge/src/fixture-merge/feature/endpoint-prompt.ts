import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { Inputs } from '@fixture-automation/openapi-fixtures';

import { MERGE_INPUTS } from '../common/fixture-merge-cli.const.ts';

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

/** True for a known HTTP method in any casing, surrounding whitespace ignored. */
export const isHttpMethod = (method: string): boolean => {
  const normalized = method.trim().toLowerCase();
  const known = HTTP_METHODS.some((candidate): boolean => candidate === normalized);

  return known;
};

/** The `--endpoint-url` value when given; otherwise asks `method` then `target-url` and joins them as `METHOD,path`. */
export const endpointUrlInput = async (inputs: Inputs, given: string | undefined, usage: string): Promise<string> => {
  if (given) return given;

  const method = await inputs.required(undefined, MERGE_INPUTS.method, usage);
  const known = isHttpMethod(method);

  if (!known) throw new FixtureError(`unknown HTTP method: ${method}`, `use one of ${HTTP_METHODS.join(', ')}`);

  const targetUrl = await inputs.required(undefined, MERGE_INPUTS.targetUrl, usage);
  const endpointUrl = `${method},${targetUrl}`;

  return endpointUrl;
};
