import { Service, computed, effect, inject, linkedSignal, resource, signal, untracked } from '@angular/core';
import type { ResourceRef, Signal, WritableSignal } from '@angular/core';

import type { AiFillProgressEvent, AiFillResultEvent, MergeResult } from '@fixture-automation/fixture-studio-api/contract';

import { CHROME_AI_PROVIDER } from './chrome-built-in-ai.provider.ts';
import { ComparisonStore } from './comparison.store.ts';
import type { EngineCall, EngineStreamCall } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { AI_LOG_BLOCK_LIMIT, AI_LOG_LIMIT, DEFAULT_AI_FILL_FORM } from '../common/ai-fill.const.ts';
import type { AiDownloadOptions, AiFillForm, AiRunOptions, AiRunRequest, MergeRequest, MergedFill } from '../common/ai-fill.type.ts';
import type { DiffRequest } from '../common/comparison.type.ts';
import { appendProgress } from '../utils/ai-log.util.ts';
import { cliFillBody } from '../utils/ai-provider.util.ts';

const CANCELLED: AiFillProgressEvent = { type: 'progress', stream: 'status', text: 'Cancelled.' };

/**
 * One endpoint tab's AI fill: the running provider call, its progress, and the merge of its answer.
 * Everything belongs to one compare: a new fixture or diff drops the run, its log and its merge.
 */
@Service({ autoProvided: false })
export class AiFillStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly chrome = inject(CHROME_AI_PROVIDER);
  private readonly compared: Signal<DiffRequest | undefined> = inject(ComparisonStore).compared;

  private readonly runRequest = linkedSignal<DiffRequest | undefined, AiRunRequest | undefined>({
    source: this.compared,
    computation: (): undefined => undefined
  });

  /** Clearing a resource's params does not abort its in-flight loader, so cancel aborts through this. */
  private activeRun: AbortController | undefined;
  private readonly settledChromeRuns = signal(0);

  /** Counts "Download model" clicks; each one starts a download. */
  private readonly downloadRequest = signal<number | undefined>(undefined);

  public readonly form: WritableSignal<AiFillForm> = signal(DEFAULT_AI_FILL_FORM);

  public readonly log = linkedSignal<DiffRequest | undefined, AiFillProgressEvent[]>({
    source: this.compared,
    computation: (): AiFillProgressEvent[] => []
  });

  /** On-device model download progress, 0 to 1; `undefined` when nothing is downloading. */
  public readonly downloadRatio = linkedSignal<DiffRequest | undefined, number | undefined>({
    source: this.compared,
    computation: (): undefined => undefined
  });

  /** The last answer of this compare: it stays while a re-run loads, fails or is cancelled. */
  public readonly answer = linkedSignal<DiffRequest | undefined, AiFillResultEvent | undefined>({
    source: this.compared,
    computation: (): undefined => undefined
  });

  /** The last merge of this compare with the answer it merged, kept like `answer`. */
  public readonly merged = linkedSignal<DiffRequest | undefined, MergedFill | undefined>({
    source: this.compared,
    computation: (): undefined => undefined
  });

  /** The user cancelled the last run; a new run or compare clears it. */
  public readonly isCancelled = linkedSignal<DiffRequest | undefined, boolean>({
    source: this.compared,
    computation: (): boolean => false
  });

  /** The answer behind what is on screen: the merged one, or with no merge yet, the last answer. */
  public readonly shownAnswer: Signal<AiFillResultEvent | undefined> = computed(() => this.merged()?.answer ?? this.answer());

  /** Bumps when an on-device run or model download settles: either may have changed Chrome's availability. */
  public readonly chromeRunsSettled: Signal<number> = this.settledChromeRuns.asReadonly();

  public readonly run: ResourceRef<AiFillResultEvent | undefined> = resource({
    params: () => this.runRequest(),
    loader: async ({ params, abortSignal }): Promise<AiFillResultEvent> => {
      const run = new AbortController();
      const forwardAbort = (): void => run.abort(abortSignal.reason);

      abortSignal.addEventListener('abort', forwardAbort, { once: true });
      this.activeRun = run;

      const options: AiRunOptions = {
        signal: run.signal,
        onProgress: (event): void => this.appendLog(event),
        onDownload: (ratio): void => this.downloadRatio.set(ratio)
      };

      const answer = await this.fillWith(params, options);

      this.answer.set(answer);

      return answer;
    }
  });

  /** The on-device model download; its value is `true` once Chrome has the model. */
  public readonly download: ResourceRef<boolean | undefined> = resource({
    params: () => this.downloadRequest(),
    loader: async ({ abortSignal }): Promise<boolean> => this.downloadOnDevice(abortSignal)
  });

  private readonly mergeRequest: Signal<MergeRequest | undefined> = computed(() => {
    const request = this.runRequest();

    if (request === undefined) return undefined;

    if (!this.run.hasValue()) return undefined;

    const { context, objectShape } = request;
    const original = this.compared()?.body.fixture;
    const answer = this.run.value();
    const body = { endpointId: context.endpointId, fixture: context.fixture, populated: answer.populated, objectShape, original };
    const merge: MergeRequest = { specId: context.specId, body, answer };

    return merge;
  });

  public readonly merge: ResourceRef<MergeResult | undefined> = resource({
    params: () => this.mergeRequest(),
    loader: async ({ params, abortSignal }): Promise<MergeResult> => {
      const call: EngineCall = { signal: abortSignal };
      const merge = await this.engine.merge(params.specId, params.body, call);
      const merged: MergedFill = { answer: params.answer, merge };

      this.merged.set(merged);

      return merge;
    }
  });

  public constructor() {
    // A new compare makes a running fill stale; stop it so a paid CLI run doesn't finish for nothing.
    effect((): void => {
      this.compared();
      untracked((): void => this.abortActiveRun());
    });
  }

  public start(request: AiRunRequest): void {
    this.isCancelled.set(false);
    this.log.set([]);
    this.downloadRatio.set(undefined);
    this.runRequest.set(request);
  }

  /** Call from the "Download model" click: Chrome only starts a download with that click's user activation. */
  public startDownload(): void {
    this.downloadRatio.set(0);
    this.downloadRequest.update((count) => (count ?? 0) + 1);
  }

  /** Aborts the running call; the provider stops (the API kills the CLI when the request closes). */
  public cancel(): void {
    this.isCancelled.set(true);
    this.abortActiveRun();
    this.runRequest.set(undefined);
    this.appendLog(CANCELLED);
  }

  private abortActiveRun(): void {
    this.activeRun?.abort('cancelled');
    this.activeRun = undefined;
  }

  private async fillWith(request: AiRunRequest, options: AiRunOptions): Promise<AiFillResultEvent> {
    const { context } = request;

    if (request.provider === 'chrome') return this.fillOnDevice(request, options);

    const call: EngineStreamCall = { signal: options.signal, onProgress: options.onProgress };

    return this.engine.cliFill(context.specId, cliFillBody(context), call);
  }

  private async fillOnDevice(request: AiRunRequest, options: AiRunOptions): Promise<AiFillResultEvent> {
    try {
      return await this.chrome.fill(request.context, options);
    } finally {
      this.settledChromeRuns.update((count) => count + 1);
    }
  }

  private async downloadOnDevice(abortSignal: AbortSignal): Promise<boolean> {
    const options: AiDownloadOptions = { signal: abortSignal, onDownload: (ratio): void => this.downloadRatio.set(ratio) };

    try {
      await this.chrome.download(options);

      return true;
    } finally {
      this.downloadRatio.set(undefined);
      this.settledChromeRuns.update((count) => count + 1);
    }
  }

  private appendLog(event: AiFillProgressEvent): void {
    this.log.update((lines) => appendProgress(lines, event, AI_LOG_LIMIT, AI_LOG_BLOCK_LIMIT));
  }
}
