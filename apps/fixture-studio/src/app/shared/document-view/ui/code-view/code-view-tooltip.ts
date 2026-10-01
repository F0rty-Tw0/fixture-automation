import { StateEffect, StateField } from '@codemirror/state';
import type { Extension, Transaction } from '@codemirror/state';
import { ViewPlugin, showTooltip } from '@codemirror/view';
import type { EditorView, PluginValue, Tooltip, TooltipView } from '@codemirror/view';

import { fixAtLine } from './code-view-highlight.ts';
import type { LineHighlight } from '../../common/document-view.type.ts';

type HoveredFix = {
  readonly pos: number;
  readonly highlight: LineHighlight;
};

/** A highlighted line's text, or the fix gutter beside any line. */
const FIX_HOVER_SELECTOR = '.cm-line.cm-fix, .cm-fixGutter';

const setHovered = StateEffect.define<HoveredFix | undefined>();

const rowOf = (className: string, text: string): HTMLElement => {
  const row = document.createElement('div');

  row.className = className;
  row.textContent = text;

  return row;
};

const foundRowOf = (found: string): HTMLElement => {
  const row = rowOf('cm-fixTooltip-found', 'In your fixture: ');
  const value = document.createElement('code');

  value.textContent = found;
  row.append(value);

  return row;
};

/** What a highlight means, then why the value was broken and what the fixture held, when known. */
const tooltipDomOf = (highlight: LineHighlight): HTMLElement => {
  const dom = document.createElement('div');

  dom.className = `cm-fixTooltip cm-fix-${highlight.outcome}`;
  dom.append(rowOf('cm-fixTooltip-label', highlight.label));

  if (highlight.reason !== undefined) dom.append(rowOf('cm-fixTooltip-reason', highlight.reason));

  if (highlight.found !== undefined) dom.append(foundRowOf(highlight.found));

  return dom;
};

const tooltipOf = (hovered: HoveredFix | undefined): Tooltip | null => {
  if (hovered === undefined) return null;

  const create = (): TooltipView => {
    const view: TooltipView = { dom: tooltipDomOf(hovered.highlight) };

    return view;
  };

  const tooltip: Tooltip = { pos: hovered.pos, above: true, create };

  return tooltip;
};

const updateHovered = (value: HoveredFix | undefined, transaction: Transaction): HoveredFix | undefined => {
  for (const effect of transaction.effects) {
    if (effect.is(setHovered)) return effect.value;
  }

  if (transaction.docChanged) return undefined;

  return value;
};

const hoveredField = StateField.define<HoveredFix | undefined>({
  create: (): undefined => undefined,
  update: updateHovered,
  provide: (field): Extension => showTooltip.from(field, tooltipOf)
});

/** Where the hovered line starts: a text line knows its own position; the gutter only has the pointer's height. */
const lineStartAt = (view: EditorView, fixPart: Element, event: MouseEvent): number => {
  const isText = fixPart.classList.contains('cm-line');

  if (isText) return view.posAtDOM(fixPart);

  const block = view.lineBlockAtHeight(event.clientY - view.documentTop);

  return block.from;
};

/** The highlight under the pointer, on a highlighted line's text or in the fix gutter beside any line. */
const hoveredAt = (view: EditorView, event: MouseEvent): HoveredFix | undefined => {
  const { target } = event;

  if (!(target instanceof Element)) return undefined;

  const fixPart = target.closest(FIX_HOVER_SELECTOR);

  if (fixPart === null) return undefined;

  const pos = lineStartAt(view, fixPart, event);
  const line = view.state.doc.lineAt(pos);
  const highlight = fixAtLine(view.state, line.number);

  if (highlight === undefined) return undefined;

  const hovered: HoveredFix = { pos: line.from, highlight };

  return hovered;
};

const showHovered = (view: EditorView, hovered: HoveredFix | undefined): void => {
  const current = view.state.field(hoveredField);

  if (current?.highlight === hovered?.highlight) return;

  view.dispatch({ effects: setHovered.of(hovered) });
};

/**
 * Listens on the whole editor: CodeMirror's own handlers and `hoverTooltip` see only the text, never the gutter
 * where the fix glyph sits.
 */
const hoverPlugin = ViewPlugin.define((view: EditorView): PluginValue => {
  const onMove = (event: MouseEvent): void => {
    showHovered(view, hoveredAt(view, event));
  };

  const onLeave = (): void => {
    showHovered(view, undefined);
  };

  view.dom.addEventListener('mousemove', onMove);
  view.dom.addEventListener('mouseleave', onLeave);

  const destroy = (): void => {
    view.dom.removeEventListener('mousemove', onMove);
    view.dom.removeEventListener('mouseleave', onLeave);
  };

  const plugin: PluginValue = { destroy };

  return plugin;
});

/** A tooltip for the fix highlight under the pointer: what it means, why the value was broken, and what it held. */
export const fixTooltipExtension: Extension = [hoveredField, hoverPlugin];
