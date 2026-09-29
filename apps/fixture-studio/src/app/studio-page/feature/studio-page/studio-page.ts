import { Component, computed, inject } from '@angular/core';
import type { Signal } from '@angular/core';

import { EndpointsStep } from '../../../endpoints/feature/endpoints-step/endpoints-step.ts';
import { FixtureGeneration } from '../../../spec/domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../../spec/domain-logic/spec-browser.service.ts';
import { SpecStep } from '../../../spec-loading/feature/spec-step/spec-step.ts';
import { WorkspaceStep } from '../../../workspace/feature/workspace-step/workspace-step.ts';
import type { StudioProgress, StudioSteps } from '../../common/studio.type.ts';
import { StudioStep } from '../../ui/studio-step/studio-step.ts';
import { studioSteps } from '../../utils/studio-steps.util.ts';
import { EndpointSteps } from '../endpoint-steps/endpoint-steps.ts';

/**
 * The whole studio on one page, one pipeline rail: spec, endpoints and generate, then compare, missing values and AI fill
 * for the endpoint chosen in Generate. Each generated endpoint keeps its own last three steps.
 */
@Component({
  selector: 'fs-studio-page',
  imports: [EndpointSteps, EndpointsStep, SpecStep, StudioStep, WorkspaceStep],
  templateUrl: './studio-page.html',
  styleUrl: './studio-page.scss'
})
export class StudioPage {
  protected readonly browser = inject(SpecBrowser);
  protected readonly generation = inject(FixtureGeneration);

  /** The first three steps; before any fixture, the last three simply wait. */
  protected readonly steps: Signal<StudioSteps> = computed(() => {
    const hasSpec = this.browser.loadedSpec() !== undefined;
    const hasFixtures = this.generation.views().length > 0;
    const progress: StudioProgress = { hasSpec, hasFixtures, hasDiff: false, isFilling: false, hasMerge: false };

    return studioSteps(progress);
  });

  protected readonly specStatus = computed(() => {
    const isLoading = this.browser.isLoading();

    if (isLoading) return 'Loading…';

    const source = this.browser.sourceLabel();
    const spec = this.browser.loadedSpec();

    if (spec !== undefined && source !== undefined) return `From ${source}`;

    return 'URL or JSON file';
  });

  protected readonly endpointsStatus = computed(() => {
    const spec = this.browser.loadedSpec();

    if (spec === undefined) return 'Waiting for a spec';

    return `${this.browser.selectedCount()} of ${spec.endpoints.length} selected`;
  });

  protected readonly generateStatus = computed(() => {
    const count = this.generation.views().length;

    if (count === 0) return 'Waiting for fixtures';

    return count === 1 ? '1 endpoint generated' : `${count} endpoints generated`;
  });
}
