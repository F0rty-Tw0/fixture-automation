import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fixAtLine, highlightExtension, showHighlights } from './code-view-highlight.ts';
import { rangeRectsMock } from '../../../../test/mocks/browser.mock.ts';
import type { LineHighlight } from '../../common/document-view.type.ts';

const DOC = '{\n  "customer": {\n    "id": "cus_1"\n  },\n  "memo": "x"\n}';
const CUSTOMER: LineHighlight = {
  from: 2,
  to: 4,
  origin: 'missing',
  outcome: 'sampler',
  label: 'customer · Was missing · Generated from the schema'
};
const CUSTOMER_ID: LineHighlight = {
  from: 3,
  to: 3,
  origin: 'missing',
  outcome: 'unfilled',
  label: 'customer.id · Was missing · Still broken'
};
const PAST_THE_END: LineHighlight = { from: 5, to: 40, origin: 'broken', outcome: 'ai', label: 'memo · Was broken · Filled by AI' };

describe('FEATURE: code view line highlights', (): void => {
  let view: EditorView;

  const outcomes = (): (string | undefined)[] => {
    const lines = view.dom.querySelectorAll('.cm-line');

    return Array.from(lines, (line: Element): string | undefined => /cm-fix-(\w+)/u.exec(line.className)?.[1]);
  };

  beforeEach((): void => {
    rangeRectsMock();

    const state = EditorState.create({ doc: DOC, extensions: [highlightExtension] });

    view = new EditorView({ state, parent: document.body });
  });

  afterEach((): void => {
    view.destroy();
  });

  it('GIVEN no highlights WHEN rendered THEN marks no line', (): void => {
    expect(view.dom.querySelector('.cm-fix')).toBeNull();
  });

  describe('GIVEN nested highlights', (): void => {
    beforeEach((): void => {
      view.dispatch(showHighlights([CUSTOMER, CUSTOMER_ID, PAST_THE_END]));
    });

    it('WHEN rendered THEN marks every covered line, the later highlight winning where they overlap', (): void => {
      expect(outcomes()).toStrictEqual([undefined, 'sampler', 'unfilled', 'sampler', 'ai', 'ai']);
    });

    it('WHEN rendered THEN the glyph names the outcome too, so it does not rest on colour alone', (): void => {
      const markers = view.dom.querySelectorAll('.cm-fixMarker');
      const glyphs = Array.from(markers, (marker: Element): string | null => marker.textContent);

      expect(glyphs).toStrictEqual(['+S', '+×', '!A']);
    });

    it('WHEN a line is looked up THEN gives the narrowest highlight on it', (): void => {
      expect(fixAtLine(view.state, 3)).toBe(CUSTOMER_ID);
      expect(fixAtLine(view.state, 1)).toBeUndefined();
    });

    it('WHEN the document is replaced THEN drops them', (): void => {
      const changes = { from: 0, to: view.state.doc.length, insert: '{}' };

      view.dispatch({ changes });

      expect(view.dom.querySelector('.cm-fix')).toBeNull();
    });

    it('WHEN a transaction only moves the cursor THEN keeps them', (): void => {
      const selection = { anchor: 1 };

      view.dispatch({ selection });

      expect(view.dom.querySelectorAll('.cm-fix')).toHaveLength(5);
    });
  });

  describe('GIVEN a still-broken parent listed after a child filled by AI', (): void => {
    const filledId: LineHighlight = { ...CUSTOMER_ID, outcome: 'ai', label: 'customer.id · Was missing · Filled by AI' };
    const brokenParent: LineHighlight = { ...CUSTOMER, outcome: 'unfilled', label: 'customer · Was missing · Still broken' };

    beforeEach((): void => {
      view.dispatch(showHighlights([filledId, brokenParent]));
    });

    it('WHEN rendered THEN the child keeps its own mark inside the parent', (): void => {
      expect(outcomes()).toStrictEqual([undefined, 'unfilled', 'ai', 'unfilled', undefined, undefined]);
    });

    it('WHEN rendered THEN the child keeps its own glyph', (): void => {
      const markers = view.dom.querySelectorAll('.cm-fixMarker');
      const glyphs = Array.from(markers, (marker: Element): string | null => marker.textContent);

      expect(glyphs).toStrictEqual(['+×', '+A']);
    });
  });
});
