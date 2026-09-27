import { Component, computed, inject } from '@angular/core';
import { FormField, form, validate } from '@angular/forms/signals';
import type { SchemaPathTree, ValidationError } from '@angular/forms/signals';
import { MatButton } from '@angular/material/button';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatOption } from '@angular/material/core';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatProgressBar } from '@angular/material/progress-bar';
import { MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';

import type { GenerateOptions } from '../../common/studio.type.ts';
import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { EndpointList } from '../../ui/endpoint-list/endpoint-list.ts';

const NO_FORMAT_ERROR: ValidationError = { kind: 'format', message: 'Pick at least one format.' };

const generateOptionsSchema = (path: SchemaPathTree<GenerateOptions>): void => {
  validate(path, ({ value }) => {
    const options = value();
    const hasFormat = options.json || options.stub || options.types;

    return hasFormat ? undefined : NO_FORMAT_ERROR;
  });
};

/** Step two: filter the spec's endpoints, pick some, choose formats, and generate. */
@Component({
  selector: 'fs-endpoints-step',
  imports: [EndpointList, FormField, MatButton, MatCheckbox, MatFormField, MatInput, MatLabel, MatOption, MatProgressBar, MatSelect, MatSlideToggle],
  templateUrl: './endpoints-step.html',
  styleUrl: './endpoints-step.scss'
})
export class EndpointsStep {
  protected readonly browser = inject(SpecBrowser);
  protected readonly generation = inject(FixtureGeneration);

  protected readonly filterForm = form(this.browser.filter);
  protected readonly optionsForm = form(this.generation.options, generateOptionsSchema);

  protected readonly generateLabel = computed(() => {
    const count = this.browser.selectedCount();

    return count === 1 ? 'Generate 1 fixture' : `Generate ${count} fixtures`;
  });
}
