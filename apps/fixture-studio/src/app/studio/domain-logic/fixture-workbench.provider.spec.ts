import { Component, inject } from '@angular/core';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { describe, expect, it } from 'vitest';

import { FixtureAiFill } from './fixture-ai-fill.service.ts';
import { FixtureComparison } from './fixture-comparison.service.ts';
import { provideFixtureWorkbench } from './fixture-workbench.provider.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

@Component({ selector: 'fs-workbench-host', template: '', providers: [provideFixtureWorkbench()] })
class WorkbenchHost {
  public readonly comparison = inject(FixtureComparison);
  public readonly fill = inject(FixtureAiFill);
}

describe('FEATURE: fixture workbench provider', (): void => {
  it('GIVEN two workbenches WHEN each injects the services THEN each gets its own state', (): void => {
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: studioEngineMock() };

    TestBed.configureTestingModule({ providers: [engineProvider] });

    const first = TestBed.createComponent(WorkbenchHost).componentInstance;
    const second = TestBed.createComponent(WorkbenchHost).componentInstance;

    expect(first.comparison).not.toBe(second.comparison);
    expect(first.fill).not.toBe(second.fill);
  });
});
