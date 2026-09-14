import { isRecord } from '@fixture-automation/shared';

import { errorMessage } from './error-message.util.ts';
import { FixtureError } from '../common/fixture.error.ts';
import type { OpenApiSpec } from '../common/openapi.type.ts';

const YAML_START = /^\s*openapi\s*:/;
const YAML_EXTENSIONS = ['.yaml', '.yml'];

const isYamlLocation = (specUrl: string | URL): boolean => {
  const location = specUrl instanceof URL ? specUrl.pathname : specUrl;
  const lowered = location.toLowerCase();

  return YAML_EXTENSIONS.some((extension: string): boolean => lowered.endsWith(extension));
};

const isOpenApiSpec = (value: unknown): value is OpenApiSpec => {
  if (!isRecord(value)) return false;

  const components = value['components'];

  if (!isRecord(components)) return false;

  return isRecord(components['schemas']);
};

const parseJson = (text: string, url: string, isYamlPath: boolean): unknown => {
  try {
    const parsed: unknown = JSON.parse(text);

    return parsed;
  } catch (error: unknown) {
    const hasYamlBody = YAML_START.test(text);
    const isYaml = isYamlPath || hasYamlBody;

    if (isYaml) {
      throw new FixtureError(`spec at ${url} is YAML; this loader reads JSON only`, 'convert it to JSON (openapi-types accepts YAML)');
    }

    throw new FixtureError(`spec at ${url} is not JSON: ${errorMessage(error)}`, 'use the raw JSON link, not an HTML page');
  }
};

export const parseSpec = (text: string, specUrl: string | URL): OpenApiSpec => {
  const url = specUrl.toString();
  const parsed = parseJson(text, url, isYamlLocation(specUrl));

  if (!isOpenApiSpec(parsed)) {
    throw new FixtureError(`spec at ${url} has no components.schemas`, 'pass the OpenAPI document, not a fixture');
  }

  return parsed;
};
