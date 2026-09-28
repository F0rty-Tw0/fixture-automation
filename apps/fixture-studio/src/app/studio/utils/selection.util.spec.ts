import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';
import { describe, expect, it } from 'vitest';

import { selectedEndpointIds, toggledSelection, withSelection } from './selection.util.ts';
import { ENDPOINT_STUB } from '../test/stubs/studio.stub.ts';

describe('FEATURE: selection toggling', (): void => {
  it('GIVEN an unselected id WHEN toggled THEN adds it', (): void => {
    expect(toggledSelection(new Set(['a']), 'b')).toStrictEqual(new Set(['a', 'b']));
  });

  it('GIVEN a selected id WHEN toggled THEN removes it', (): void => {
    expect(toggledSelection(new Set(['a', 'b']), 'a')).toStrictEqual(new Set(['b']));
  });

  it('GIVEN a selection WHEN toggled THEN leaves the input set unchanged', (): void => {
    const selected = new Set(['a']);

    toggledSelection(selected, 'b');

    expect(selected).toStrictEqual(new Set(['a']));
  });
});

describe('FEATURE: bulk selection', (): void => {
  it('GIVEN ids WHEN selecting THEN adds them all', (): void => {
    expect(withSelection(new Set(['a']), ['b', 'c'], true)).toStrictEqual(new Set(['a', 'b', 'c']));
  });

  it('GIVEN ids WHEN deselecting THEN removes only those', (): void => {
    expect(withSelection(new Set(['a', 'b', 'c']), ['a', 'c'], false)).toStrictEqual(new Set(['b']));
  });
});

describe('FEATURE: selected ids in spec order', (): void => {
  it('GIVEN a selection made out of order WHEN listed THEN follows the spec order', (): void => {
    const first: Endpoint = { ...ENDPOINT_STUB, id: 'GET /a' };
    const second: Endpoint = { ...ENDPOINT_STUB, id: 'GET /b' };
    const third: Endpoint = { ...ENDPOINT_STUB, id: 'GET /c' };

    const ids = selectedEndpointIds([first, second, third], new Set(['GET /c', 'GET /a']));

    expect(ids).toStrictEqual(['GET /a', 'GET /c']);
  });
});
