import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { syntaxHighlighting } from '@codemirror/language';
import type { Chunk, MergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import type { ChangeSpec, Compartment, Extension, StateEffect, TransactionSpec } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { classHighlighter } from '@lezer/highlight';
import { basicSetup } from 'codemirror';

import type { ChangedLines, CodeLanguage } from '../../common/studio.type.ts';

export const languageExtension = (language: CodeLanguage): Extension => {
  if (language === 'json') return json();

  return javascript({ typescript: true });
};

/** A read-only editor labelled for assistive tech; its language sits in `languageSlot` so it can be swapped later. */
export const editorExtensions = (label: string, language: CodeLanguage, languageSlot: Compartment): Extension[] => {
  const attributes = { 'aria-label': label, 'aria-readonly': 'true' };

  return [
    basicSetup,
    syntaxHighlighting(classHighlighter),
    EditorState.readOnly.of(true),
    EditorView.contentAttributes.of(attributes),
    languageSlot.of(languageExtension(language))
  ];
};

/** Swaps the language, and the document too when it differs, in one transaction. */
export const syncEditor = (view: EditorView, doc: string, languageEffect: StateEffect<unknown>): void => {
  const effects = [languageEffect];
  const currentDoc = view.state.sliceDoc();
  const isSameDoc = currentDoc === doc;

  if (isSameDoc) {
    const reconfiguration: TransactionSpec = { effects };

    view.dispatch(reconfiguration);

    return;
  }

  const changes: ChangeSpec = { from: 0, to: view.state.doc.length, insert: doc };
  const selection = { anchor: 0 };
  const replacement: TransactionSpec = { changes, effects, selection, scrollIntoView: true };

  view.dispatch(replacement);
};

/** The lines each changed chunk covers on the document side (B) of a diff; a pure deletion covers the line it sits on. */
export const changedLinesOf = (merge: MergeView): ChangedLines[] => {
  const { doc } = merge.b.state;

  const linesOf = (chunk: Chunk): ChangedLines => {
    const from = doc.lineAt(chunk.fromB).number;
    const to = doc.lineAt(chunk.endB).number;
    const lines: ChangedLines = { from, to };

    return lines;
  };

  return merge.chunks.map(linesOf);
};

/** Centers a change in the diff; both sides scroll together, and the selection moves there for keyboard users. */
export const revealChange = (merge: MergeView, index: number): void => {
  const chunk = merge.chunks[index];

  if (chunk === undefined) return;

  const effects = EditorView.scrollIntoView(chunk.fromB, { y: 'center' });
  const selection = { anchor: chunk.fromB };
  const reveal: TransactionSpec = { effects, selection };

  merge.b.dispatch(reveal);
};
