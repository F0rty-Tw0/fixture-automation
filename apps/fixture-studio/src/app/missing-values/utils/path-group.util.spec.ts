import { describe, expect, it } from 'vitest';

import { groupPathsByRoot } from './path-group.util.ts';
import type { PathGroup } from '../common/missing-values.type.ts';

describe('FEATURE: missing paths grouped by their first segment', (): void => {
  it('GIVEN dotted paths WHEN grouped THEN each first segment collects its paths in first-seen order', (): void => {
    const expected: PathGroup[] = [
      { root: 'memo', paths: ['memo'] },
      { root: 'customer', paths: ['customer.id', 'customer.address.city'] }
    ];

    expect(groupPathsByRoot(['memo', 'customer.id', 'customer.address.city'], undefined)).toStrictEqual(expected);
  });

  it('GIVEN indexed paths WHEN grouped THEN the array property and a leading index are segments too', (): void => {
    const groups = groupPathsByRoot(['items[0].id', 'items[1].id', '[2].name'], undefined);

    expect(groups.map((group) => group.root)).toStrictEqual(['items', '[2]']);
  });

  it('GIVEN paths inside an envelope WHEN grouped THEN groups by the segment below it, keeping the full paths', (): void => {
    const expected: PathGroup[] = [
      { root: 'customer', paths: ['data.customer.id'] },
      { root: 'memo', paths: ['data.memo'] }
    ];

    expect(groupPathsByRoot(['data.customer.id', 'data.memo'], 'data')).toStrictEqual(expected);
  });

  it('GIVEN an envelope some paths lack WHEN grouped THEN those group by their own first segment', (): void => {
    const groups = groupPathsByRoot(['meta.page'], 'data');

    expect(groups.map((group) => group.root)).toStrictEqual(['meta']);
  });

  it('GIVEN no paths WHEN grouped THEN there are no groups', (): void => {
    expect(groupPathsByRoot([], undefined)).toStrictEqual([]);
  });
});
