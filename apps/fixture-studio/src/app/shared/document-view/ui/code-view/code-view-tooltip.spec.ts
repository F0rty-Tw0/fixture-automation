import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { highlightExtension, showHighlights } from './code-view-highlight.ts';
import { fixTooltipExtension } from './code-view-tooltip.ts';
import { rangeRectsMock } from '../../../../test/mocks/browser.mock.ts';
import type { LineHighlight } from '../../common/document-view.type.ts';

/** One line, so jsdom's zero-height layout puts every pointer on it. */
const DOC = '0';
const BROKEN_ID: LineHighlight = {
  from: 1,
  to: 1,
  origin: 'broken',
  outcome: 'broken',
  label: 'id · Broken in your fixture',
  reason: 'must be string',
  found: '0'
};
const FILLED_MEMO: LineHighlight = { from: 1, to: 1, origin: 'missing', outcome: 'ai', label: 'memo · Was missing · Filled by AI' };

describe('FEATURE: code view fix tooltip', (): void => {
  let view: EditorView;

  const hover = (selector: string): void => {
    const target = view.dom.querySelector(selector);
    const move = new MouseEvent('mousemove', { bubbles: true });

    target?.dispatchEvent(move);
  };

  const tooltipRows = (): (string | null)[] => {
    const rows = view.dom.querySelectorAll('.cm-fixTooltip > *');

    return Array.from(rows, (row: Element): string | null => row.textContent);
  };

  beforeEach((): void => {
    rangeRectsMock();

    const extensions = [highlightExtension, fixTooltipExtension];
    const state = EditorState.create({ doc: DOC, extensions });

    view = new EditorView({ state, parent: document.body });
  });

  afterEach((): void => {
    view.destroy();
  });

  describe('GIVEN a broken value with a reason', (): void => {
    beforeEach((): void => {
      view.dispatch(showHighlights([BROKEN_ID]));
    });

    it('WHEN its gutter glyph is hovered THEN says what is wrong, why, and what the fixture held', (): void => {
      hover('.cm-fixMarker');

      expect(tooltipRows()).toStrictEqual(['id · Broken in your fixture', 'must be string', 'In your fixture: 0']);
    });

    it('WHEN its line is hovered THEN shows the same tooltip', (): void => {
      hover('.cm-line.cm-fix');

      expect(tooltipRows()).toHaveLength(3);
    });

    it('WHEN the pointer moves off the highlight THEN hides it', (): void => {
      hover('.cm-fixMarker');
      hover('.cm-content');

      expect(view.dom.querySelector('.cm-fixTooltip')).toBeNull();
    });

    it('WHEN the pointer leaves the editor THEN hides it', (): void => {
      hover('.cm-fixMarker');
      view.dom.dispatchEvent(new MouseEvent('mouseleave'));

      expect(view.dom.querySelector('.cm-fixTooltip')).toBeNull();
    });
  });

  it('GIVEN a filled value with no reason WHEN hovered THEN shows its label only', (): void => {
    view.dispatch(showHighlights([FILLED_MEMO]));

    hover('.cm-fixMarker');

    expect(tooltipRows()).toStrictEqual(['memo · Was missing · Filled by AI']);
  });

  it('GIVEN no highlight WHEN the text is hovered THEN shows no tooltip', (): void => {
    hover('.cm-line');

    expect(view.dom.querySelector('.cm-fixTooltip')).toBeNull();
  });
});
