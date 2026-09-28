import { Service, computed, inject } from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';

import type { ApiErrorBody, DiffBody, DiffResult, EnvelopeBody } from '@fixture-automation/fixture-studio-api/contract';

import { parseFixtureSource } from './fixture-source.reader.ts';
import { PASTED_SOURCE_NAME } from '../common/comparison.const.ts';
import type { CompareForm, DiffRequest, ExistingFixture } from '../common/comparison.type.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { GenerationStore } from '../data-access/generation.store.ts';
import { SpecStore } from '../data-access/spec.store.ts';
import { toApiError } from '../utils/api-error.util.ts';
import { isSameDiffRequest } from '../utils/diff-request.util.ts';
import { prettyJson } from '../utils/fixture-source.util.ts';

/** Compares an existing fixture (read locally) with what the schema expects for one endpoint. */
@Service({ autoProvided: false })
export class FixtureComparison {
  private readonly store = inject(ComparisonStore);
  private readonly specStore = inject(SpecStore);
  private readonly generation = inject(GenerationStore);

  public readonly form: WritableSignal<CompareForm> = this.store.form;
  public readonly existing: Signal<ExistingFixture | undefined> = this.store.existing.asReadonly();
  public readonly sourceError: Signal<string | undefined> = this.store.sourceError.asReadonly();
  public readonly readingName: Signal<string | undefined> = this.store.readingName.asReadonly();
  public readonly envelopes: Signal<string[]> = this.store.envelopes.asReadonly();
  public readonly isComparing: Signal<boolean> = this.store.diff.isLoading;
  public readonly error: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.store.diff.error()));

  public readonly result: Signal<DiffResult | undefined> = computed(() => {
    if (!this.store.diff.hasValue()) return undefined;

    return this.store.diff.value();
  });

  public async readFile(file: File): Promise<void> {
    this.store.startReading(file.name);

    const text = await file.text();

    await this.read(text, file.name, false);
  }

  public async readPasted(): Promise<void> {
    this.store.startReading(PASTED_SOURCE_NAME);

    await this.read(this.form().pasted, PASTED_SOURCE_NAME, true);
  }

  /** Reads a file and compares it at once, inside the envelope the API detects; a rejected read compares nothing. */
  public async compareFile(file: File, endpointId: string): Promise<void> {
    await this.readFile(file);
    await this.detectAndCompare(endpointId);
  }

  public async comparePasted(endpointId: string): Promise<void> {
    await this.readPasted();
    await this.detectAndCompare(endpointId);
  }

  /** Keeping broken values diffs again without refilling them; fixing them (the default) lets AI fill rewrite them. */
  public setReplacePlaceholders(endpointId: string, replacePlaceholders: boolean): void {
    const withChoice = (form: CompareForm): CompareForm => {
      const chosen: CompareForm = { ...form, replacePlaceholders };

      return chosen;
    };

    this.form.update(withChoice);
    this.compare(endpointId);
  }

  /**
   * Diffs the existing fixture against the endpoint's schema; `requiredOnly` follows the generate options, `replacePlaceholders` the form.
   * Asking again while that exact diff is shown or loading does nothing; a failed diff can always be retried.
   */
  public compare(endpointId: string): void {
    const request = this.requestFor(endpointId);

    if (request === undefined) return;

    const isShown = this.isCurrent(endpointId);

    if (isShown) return;

    this.store.compare(request);
  }

  /** Whether the diff on screen (or loading) answers what the form asks now; false once any option or the fixture changes. */
  public isCurrent(endpointId: string): boolean {
    const request = this.requestFor(endpointId);
    const status = this.store.diff.status();
    const hasFailed = status === 'error';

    if (request === undefined || hasFailed) return false;

    return isSameDiffRequest(request, this.store.compared());
  }

  private requestFor(endpointId: string): DiffRequest | undefined {
    const spec = this.specStore.loadedSpec();
    const existing = this.store.existing();

    if (spec === undefined) return undefined;

    if (existing === undefined) return undefined;

    const { objectShape: shapeInput, replacePlaceholders } = this.form();
    const shape = shapeInput.trim();
    const objectShape = shape === '' ? undefined : shape;
    const { requiredOnly } = this.generation.options();
    const body: DiffBody = { endpointId, fixture: existing.value, requiredOnly, objectShape, replacePlaceholders };
    const request: DiffRequest = { specId: spec.specId, body };

    return request;
  }

  /** A rejected read leaves the previous fixture loaded; that one must not be compared as if it were the new one. */
  private async detectAndCompare(endpointId: string): Promise<void> {
    const isRejected = this.sourceError() !== undefined;

    if (isRejected) return;

    await this.detectEnvelope(endpointId);
    this.compare(endpointId);
  }

  /** Offers the API's envelope candidates and picks the detected one, or none; a newer fixture read meanwhile wins. */
  private async detectEnvelope(endpointId: string): Promise<void> {
    const spec = this.specStore.loadedSpec();
    const existing = this.store.existing();

    if (spec === undefined || existing === undefined) return;

    const body: EnvelopeBody = { endpointId, fixture: existing.value };
    const result = await this.store.detectEnvelope(spec.specId, body);
    const current = this.store.existing();
    const isStale = current !== existing;

    if (isStale) return;

    const objectShape = result.detected ?? '';
    const withEnvelope = (form: CompareForm): CompareForm => {
      const detected: CompareForm = { ...form, objectShape };

      return detected;
    };

    this.store.envelopes.set(result.candidates);
    this.form.update(withEnvelope);
  }

  private async read(text: string, name: string, isPasted: boolean): Promise<void> {
    const parse = await parseFixtureSource(text, name, isPasted);

    if (parse.kind === 'error') {
      this.store.rejectSource(parse.message);

      return;
    }

    const existing: ExistingFixture = { name, value: parse.value, pretty: prettyJson(parse.value) };

    this.store.setExisting(existing);
  }
}
