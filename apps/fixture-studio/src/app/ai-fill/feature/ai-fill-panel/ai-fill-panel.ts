import { Component, computed, inject, input } from '@angular/core';
import type { Signal } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';

import type { ApiErrorBody } from '@fixture-automation/fixture-studio-api/contract';

import { ApiErrorNotice } from '../../../shared/api-error/ui/api-error-notice/api-error-notice.ts';
import type { FixtureDocument, HashedExport } from '../../../shared/document-view/common/document-view.type.ts';
import { DocumentView } from '../../../shared/document-view/ui/document-view/document-view.ts';
import { jsonDocument } from '../../../shared/document-view/utils/json-document.util.ts';
import { NoticeList } from '../../../shared/notice/ui/notice-list/notice-list.ts';
import type { FixtureView } from '../../../spec/common/generation.type.ts';
import { FillOutcome } from '../../../workbench/domain-logic/fill-outcome.service.ts';
import { FixHighlights } from '../../../workbench/domain-logic/fix-highlights.service.ts';
import { FixtureAiFill } from '../../../workbench/domain-logic/fixture-ai-fill.service.ts';
import { FixtureComparison } from '../../../workbench/domain-logic/fixture-comparison.service.ts';
import { FixtureExportNaming } from '../../../workbench/domain-logic/fixture-export-naming.service.ts';
import { OnDeviceAi } from '../../../workbench/domain-logic/on-device-ai.service.ts';
import { AI_AVAILABILITY_LABELS } from '../../common/ai-availability.const.ts';
import { GeneratedFallback } from '../../ui/generated-fallback/generated-fallback.ts';
import { MergeResultView } from '../../ui/merge-result/merge-result.ts';
import { ProgressLog } from '../../ui/progress-log/progress-log.ts';

/**
 * Fills the missing paths found by compare with AI, then shows the merged, validated fixture with every value marked by
 * where it came from. A fill that fails still leaves a complete fixture: the schema-complete one.
 * The on-device model is downloaded by its own button first; filling never starts a download.
 */
@Component({
  selector: 'fs-ai-fill-panel',
  imports: [
    ApiErrorNotice,
    DocumentView,
    FormField,
    GeneratedFallback,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatProgressBar,
    MatSelect,
    MergeResultView,
    NoticeList,
    ProgressLog
  ],
  templateUrl: './ai-fill-panel.html',
  styleUrl: './ai-fill-panel.scss'
})
export class AiFillPanel {
  public readonly view = input.required<FixtureView>();

  protected readonly fill = inject(FixtureAiFill);
  protected readonly onDevice = inject(OnDeviceAi);
  protected readonly aiForm = form(this.fill.form);
  protected readonly outcome = inject(FillOutcome);
  protected readonly highlights = inject(FixHighlights);

  private readonly comparison = inject(FixtureComparison);
  private readonly exportNaming = inject(FixtureExportNaming);

  protected readonly availabilityLabel = computed(() => {
    const availability = this.onDevice.chromeAvailability.value() ?? 'unavailable';

    return AI_AVAILABILITY_LABELS[availability];
  });

  /** Download progress as a percentage while a ratio is known; `undefined` shows an indeterminate bar instead. */
  protected readonly downloadPercent = computed(() => {
    const ratio = this.onDevice.downloadRatio();

    if (ratio === undefined) return undefined;

    return Math.round(ratio * 100);
  });

  /** The fill's and the merge's failures, shown after whatever result stands in for them. */
  protected readonly errors: Signal<ApiErrorBody[]> = computed(() => {
    const errors = [this.fill.runError(), this.fill.mergeError()];

    return errors.filter((error): error is ApiErrorBody => error !== undefined);
  });

  /** The schema-complete fixture, standing in when the fill failed and this run has no merge. */
  protected readonly fallbackDocument = computed((): FixtureDocument | undefined => {
    const json = this.outcome.fallbackJson();

    if (json === undefined) return undefined;

    return jsonDocument('Generated from the schema', `${this.view().schemaName}.json`, json);
  });

  /** The final fixture, merged or generated, can be exported under the name the CLI merge gives this endpoint. */
  protected readonly hashedExport = computed((): HashedExport => {
    const view = this.view();
    const hashedExport: HashedExport = { method: view.method, path: view.path, naming: this.exportNaming };

    return hashedExport;
  });

  protected readonly filledDocument = computed((): FixtureDocument | undefined => {
    const filled = this.outcome.filledJson();

    if (filled === undefined) return undefined;

    return jsonDocument('Filled values', `${this.view().schemaName}.filled.json`, filled);
  });

  /** What the active provider does with the fixture, in one sentence. */
  protected readonly providerExplanation = computed(() => {
    const provider = this.fill.provider();
    const isChrome = provider === 'chrome';

    if (isChrome) return 'Gemini Nano runs inside this browser; the fixture and the prompt never leave your machine.';

    return "A coding-agent CLI on this machine fills the values through the Fixture Studio API, using that tool's own login.";
  });

  protected readonly existingPretty = computed(() => this.comparison.existing()?.pretty);

  /** Parts of the compare that fell back: the fallback then cannot promise every value was completed. */
  protected readonly diffWarnings: Signal<string[]> = computed(() => this.comparison.result()?.warnings ?? []);

  protected onOptInChange(isChecked: boolean): void {
    this.onDevice.setChromeOptIn(isChecked);
  }

  protected downloadModel(): void {
    this.onDevice.downloadModel();
  }

  protected recheckModel(): void {
    this.onDevice.recheckAvailability();
  }

  protected run(): void {
    this.fill.run();
  }

  protected cancel(): void {
    this.fill.cancel();
  }

  protected retryModels(): void {
    this.fill.retryModels();
  }
}
