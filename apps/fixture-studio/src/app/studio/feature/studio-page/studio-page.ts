import { Component, computed, inject } from '@angular/core';

import { FixtureGeneration } from '../../domain-logic/fixture-generation.service.ts';
import { SpecBrowser } from '../../domain-logic/spec-browser.service.ts';
import { StudioStep } from '../../ui/studio-step/studio-step.ts';
import { studioSteps } from '../../utils/studio-steps.util.ts';
import { EndpointsStep } from '../endpoints-step/endpoints-step.ts';
import { SpecStep } from '../spec-step/spec-step.ts';
import { WorkspaceStep } from '../workspace-step/workspace-step.ts';

/** The whole studio on one page: spec, endpoints, and workspace stacked on the pipeline rail. */
@Component({
  selector: 'fs-studio-page',
  imports: [EndpointsStep, SpecStep, StudioStep, WorkspaceStep],
  templateUrl: './studio-page.html',
  styleUrl: './studio-page.scss'
})
export class StudioPage {
  protected readonly browser = inject(SpecBrowser);
  private readonly generation = inject(FixtureGeneration);

  protected readonly steps = computed(() => {
    const hasSpec = this.browser.loadedSpec() !== undefined;
    const hasFixtures = this.generation.views().length > 0;

    return studioSteps(hasSpec, hasFixtures);
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

  protected readonly workspaceStatus = computed(() => {
    const count = this.generation.views().length;

    if (count === 0) return 'Waiting for fixtures';

    return count === 1 ? '1 endpoint generated' : `${count} endpoints generated`;
  });
}
