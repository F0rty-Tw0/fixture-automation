import type { AiFillBody } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { chooseAiProvider, cliFillBody, isOfferedOnDevice, onDeviceState } from './ai-provider.util.ts';
import { MISSING_FILE_STUB } from '../../test/stubs/studio.stub.ts';
import { ON_DEVICE_PROMPT_BYTE_LIMIT } from '../common/ai-fill.const.ts';
import type { AiAvailability, AiFillContext, AiProviderId, DiffPromptSize, OnDeviceState } from '../common/ai-fill.type.ts';

const FIXTURE = { id: 'in_1' };
const CONTEXT: AiFillContext = {
  specId: 'spec-1',
  endpointId: 'GET /v1/invoices',
  fixture: FIXTURE,
  missing: MISSING_FILE_STUB,
  scenario: 'overdue',
  tool: 'codex',
  model: 'gpt-5'
};

describe('FEATURE: AI provider choice', (): void => {
  it.each<[boolean, AiAvailability | undefined, AiProviderId]>([
    [true, 'available', 'chrome'],
    [true, 'downloadable', 'chrome'],
    [true, 'downloading', 'chrome'],
    [true, 'unavailable', 'cli'],
    [true, undefined, 'cli'],
    [false, 'available', 'cli'],
    [false, undefined, 'cli']
  ])('GIVEN opted in %s and Chrome %s WHEN choosing THEN picks %s', (isOptedIn, availability, expected): void => {
    expect(chooseAiProvider(isOptedIn, availability)).toBe(expected);
  });

  it.each<[string, DiffPromptSize, boolean | undefined, boolean]>([
    ['no diff and no earlier answer', undefined, undefined, true],
    ['a settled diff that fits', ON_DEVICE_PROMPT_BYTE_LIMIT, false, true],
    ['a settled diff too large', ON_DEVICE_PROMPT_BYTE_LIMIT + 1, true, false],
    ['a diff loading after a too-large one', 'loading', false, false],
    ['a diff loading after one that fit', 'loading', true, true],
    ['the first diff loading', 'loading', undefined, true]
  ])('GIVEN %s WHEN the on-device offer is decided THEN it is kept or recomputed', (_label, size, wasOffered, expected): void => {
    expect(isOfferedOnDevice(size, wasOffered)).toBe(expected);
  });

  it('GIVEN a fill context WHEN sent to the local CLI THEN becomes the ai-fill body, without the spec id', (): void => {
    const expected: AiFillBody = {
      endpointId: 'GET /v1/invoices',
      fixture: FIXTURE,
      missing: MISSING_FILE_STUB,
      tool: 'codex',
      model: 'gpt-5',
      scenario: 'overdue'
    };

    expect(cliFillBody(CONTEXT)).toStrictEqual(expected);
  });
});

describe('FEATURE: on-device model state', (): void => {
  it.each<[AiAvailability | undefined, OnDeviceState]>([
    [undefined, 'checking'],
    ['available', 'ready'],
    ['downloadable', 'needs-download'],
    ['downloading', 'downloading'],
    ['unavailable', 'unavailable']
  ])('GIVEN Chrome reports %s and no download WHEN read THEN is %s', (availability, expected): void => {
    expect(onDeviceState(availability, false)).toBe(expected);
  });

  it('GIVEN a download the user started WHEN Chrome still reports downloadable THEN is downloading', (): void => {
    expect(onDeviceState('downloadable', true)).toBe('downloading');
  });
});
