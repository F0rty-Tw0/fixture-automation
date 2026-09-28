import type { AiFillBody } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { chooseAiProvider, cliFillBody, fitsOnDevice, onDeviceState } from './ai-provider.util.ts';
import { ON_DEVICE_PROMPT_BYTE_LIMIT } from '../common/ai-fill.const.ts';
import type { AiAvailability, AiFillContext, AiProviderId, OnDeviceState } from '../common/ai-fill.type.ts';
import { MISSING_FILE_STUB } from '../test/stubs/studio.stub.ts';

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

  it.each<[string, number, boolean]>([
    ['a prompt at the limit', ON_DEVICE_PROMPT_BYTE_LIMIT, true],
    ['a prompt past the limit', ON_DEVICE_PROMPT_BYTE_LIMIT + 1, false]
  ])('GIVEN %s WHEN sized for the on-device model THEN fits is %s', (_label, promptBytes, expected): void => {
    expect(fitsOnDevice(promptBytes)).toBe(expected);
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
