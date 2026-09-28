import { Component, computed, inject, input } from '@angular/core';
import { FormField, form } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';
import { MatTab, MatTabContent, MatTabGroup } from '@angular/material/tabs';

import { AI_AVAILABILITY_LABELS } from '../../common/ai-fill.const.ts';
import type { FixtureDocument, FixtureView } from '../../common/studio.type.ts';
import { FixtureAiFill } from '../../domain-logic/fixture-ai-fill.service.ts';
import { FixtureComparison } from '../../domain-logic/fixture-comparison.service.ts';
import { OnDeviceAi } from '../../domain-logic/on-device-ai.service.ts';
import { ApiErrorNotice } from '../../ui/api-error-notice/api-error-notice.ts';
import { DocumentView } from '../../ui/document-view/document-view.ts';
import { ProgressLog } from '../../ui/progress-log/progress-log.ts';
import { jsonDocument } from '../../utils/fixture-document.util.ts';

/**
 * Fills the missing paths found by compare with AI, then shows the merged, validated fixture. The on-device model is
 * downloaded by its own button first; filling never starts a download.
 */
@Component({
  selector: 'fs-ai-fill-panel',
  imports: [
    ApiErrorNotice,
    DocumentView,
    FormField,
    MatButton,
    MatCheckbox,
    MatFormField,
    MatHint,
    MatInput,
    MatLabel,
    MatOption,
    MatProgressBar,
    MatSelect,
    MatTab,
    MatTabContent,
    MatTabGroup,
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

  private readonly comparison = inject(FixtureComparison);

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

  protected readonly mergedDocument = computed((): FixtureDocument | undefined => {
    const merge = this.fill.mergeResult();

    if (merge === undefined) return undefined;

    return jsonDocument('Merged fixture', `${this.view().schemaName}.json`, merge.mergedJson);
  });

  protected readonly filledDocument = computed((): FixtureDocument | undefined => {
    const filled = this.fill.filledJson();

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
