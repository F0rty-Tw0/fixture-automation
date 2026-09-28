import { MergeView } from '@codemirror/merge';
import { Compartment } from '@codemirror/state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { changedLinesOf, editorExtensions, revealChange } from './code-view-editor.ts';
import { rangeRectsMock } from '../../test/mocks/browser.mock.ts';
import { lineDiff } from '../../utils/line-diff.util.ts';

const ORIGINAL = '{\n  "id": "in_1"\n}';
const COMPLETE = '{\n  "id": "in_1",\n  "memo": "Net 30",\n  "status": "open"\n}';

describe('FEATURE: code view editor helpers', (): void => {
  let merge: MergeView;

  beforeEach((): void => {
    rangeRectsMock();

    const extensions = editorExtensions('invoice.json', 'json', new Compartment());
    const a = { doc: ORIGINAL, extensions };
    const b = { doc: COMPLETE, extensions };
    const diffConfig = { override: lineDiff };

    merge = new MergeView({ a, b, parent: document.body, diffConfig });
  });

  afterEach((): void => {
    merge.destroy();
  });

  it('GIVEN a diff WHEN its changes are read THEN names the lines each covers in the document', (): void => {
    expect(changedLinesOf(merge)).toStrictEqual([{ from: 2, to: 4 }]);
  });

  it('GIVEN a diff WHEN a change is revealed THEN the cursor moves to its start', (): void => {
    const start = merge.chunks[0]?.fromB;

    revealChange(merge, 0);

    expect(merge.b.state.selection.main.head).toBe(start);
  });

  it('GIVEN a diff WHEN a change past the last is asked for THEN nothing moves', (): void => {
    revealChange(merge, 5);

    expect(merge.b.state.selection.main.head).toBe(0);
  });
});
