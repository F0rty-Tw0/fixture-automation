import { Component, DestroyRef, afterNextRender, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import type { ElementRef, Signal } from '@angular/core';
import { MatButton } from '@angular/material/button';

import { MergeView } from '@codemirror/merge';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

import { changedLinesOf, editorExtensions, languageExtension, revealChange, syncEditor } from './code-view-editor.ts';
import type { ChangeMark, CodeLanguage } from '../../common/document-view.type.ts';
import { changeMarks, nearestMark } from '../../utils/change-map.util.ts';
import { lineDiff } from '../../utils/line-diff.util.ts';

/** Diffs line by line; CodeMirror's default character diff smears distant edits in a large fixture together. */
const DIFF_CONFIG = { override: lineDiff };

/**
 * Read-only CodeMirror 6 view. The document never passes through Angular bindings:
 * it is handed to CodeMirror once, then replaced by a transaction, so multi-megabyte
 * sources stay responsive (CodeMirror renders only the visible lines). Set `original` to show it
 * and the document side by side as a diff, with a change map beside it: one mark per change, click to jump there.
 */
@Component({
  selector: 'fs-code-view',
  imports: [MatButton],
  templateUrl: './code-view.html',
  styleUrl: './code-view.scss'
})
export class CodeView {
  public readonly doc = input.required<string>();
  public readonly language = input.required<CodeLanguage>();
  public readonly label = input.required<string>();
  public readonly original = input<string | undefined>(undefined);

  private readonly editorHost = viewChild.required<ElementRef<HTMLElement>>('editor');
  private readonly languageSlot = new Compartment();
  /** The editor showing `doc`; inside `merge` when there is an original. */
  private view: EditorView | undefined;
  private merge: MergeView | undefined;

  protected readonly isDiff = signal(false);
  protected readonly changes = signal<ChangeMark[]>([]);
  protected readonly current = signal(-1);

  protected readonly changeLabel: Signal<string> = computed(() => {
    const count = this.changes().length;
    const mark = this.changes()[this.current()];

    if (mark === undefined) return count === 1 ? '1 change' : `${count} changes`;

    return `Change ${this.current() + 1} of ${count}, line ${mark.line}`;
  });

  public constructor() {
    afterNextRender((): void => {
      this.createView(this.doc(), this.language(), this.original());
    });

    effect((): void => {
      this.syncView(this.doc(), this.language(), this.original());
    });

    inject(DestroyRef).onDestroy((): void => {
      this.destroyView();
    });
  }

  protected goTo(index: number): void {
    if (this.merge === undefined) return;

    this.current.set(index);
    revealChange(this.merge, index);
  }

  protected nextChange(): void {
    const count = this.changes().length;

    this.goTo((this.current() + 1) % count);
  }

  protected previousChange(): void {
    const count = this.changes().length;
    const isAtStart = this.current() <= 0;

    if (isAtStart) {
      this.goTo(count - 1);

      return;
    }

    this.goTo(this.current() - 1);
  }

  /** A click on the change map jumps to the change nearest to where the map was clicked. */
  protected pickAt(event: MouseEvent): void {
    const map = event.currentTarget;

    if (!(map instanceof Element)) return;

    const box = map.getBoundingClientRect();
    const offset = event.clientY - box.top;
    const percent = (offset / Math.max(box.height, 1)) * 100;
    const index = nearestMark(this.changes(), percent);

    if (index >= 0) this.goTo(index);
  }

  private createView(doc: string, language: CodeLanguage, original: string | undefined): void {
    const parent = this.editorHost().nativeElement;
    const extensions = editorExtensions(this.label(), language, this.languageSlot);

    if (original === undefined) {
      const state = EditorState.create({ doc, extensions });

      this.view = new EditorView({ state, parent });
      this.refreshChanges();

      return;
    }

    const originalExtensions = editorExtensions(`Existing ${this.label()}`, language, this.languageSlot);

    const a = { doc: original, extensions: originalExtensions };
    const b = { doc, extensions };

    this.merge = new MergeView({ a, b, parent, diffConfig: DIFF_CONFIG });
    this.view = this.merge.b;
    this.refreshChanges();
  }

  private destroyView(): void {
    const root = this.merge ?? this.view;

    root?.destroy();
    this.merge = undefined;
    this.view = undefined;
  }

  /** Re-reads the diff's chunks after the documents changed; the reader starts again before the first change. */
  private refreshChanges(): void {
    const merge = this.merge;

    this.isDiff.set(merge !== undefined);
    this.current.set(-1);

    if (merge === undefined) {
      this.changes.set([]);

      return;
    }

    const lines = changedLinesOf(merge);

    this.changes.set(changeMarks(lines, merge.b.state.doc.lines));
  }

  private syncView(doc: string, language: CodeLanguage, original: string | undefined): void {
    if (this.view === undefined) return;

    const isMerge = this.merge !== undefined;
    const needsMerge = original !== undefined;

    // One view cannot switch between a single editor and a side-by-side pair, so rebuild.
    if (isMerge !== needsMerge) {
      this.destroyView();
      this.createView(doc, language, original);

      return;
    }

    const languageEffect = this.languageSlot.reconfigure(languageExtension(language));

    syncEditor(this.view, doc, languageEffect);

    if (this.merge !== undefined && original !== undefined) syncEditor(this.merge.a, original, languageEffect);

    this.refreshChanges();
  }
}
