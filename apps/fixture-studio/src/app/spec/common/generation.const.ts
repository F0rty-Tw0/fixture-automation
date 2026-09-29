import type { FIXTURE_FORMATS, FixtureFormat } from '@fixture-automation/fixture-studio-api/contract';

import type { FixtureFormatMeta, GenerateOptions } from './generation.type.ts';

export const DEFAULT_GENERATE_OPTIONS: GenerateOptions = {
  json: true,
  stub: true,
  types: false,
  requiredOnly: false
};

const JSON_FORMAT: FixtureFormatMeta = {
  label: 'JSON fixture',
  extension: '.json',
  language: 'json'
};

const STUB_FORMAT: FixtureFormatMeta = {
  label: 'TS stub',
  extension: '.stub.ts',
  language: 'typescript'
};

const TYPES_FORMAT: FixtureFormatMeta = {
  label: 'Types',
  extension: '.d.ts',
  language: 'typescript'
};

export const FIXTURE_FORMAT_META: Record<FixtureFormat, FixtureFormatMeta> = {
  json: JSON_FORMAT,
  stub: STUB_FORMAT,
  types: TYPES_FORMAT
};

/** Display order of formats: the contract's `FIXTURE_FORMATS`. */
export const FIXTURE_FORMAT_ORDER: typeof FIXTURE_FORMATS = ['json', 'stub', 'types'];
