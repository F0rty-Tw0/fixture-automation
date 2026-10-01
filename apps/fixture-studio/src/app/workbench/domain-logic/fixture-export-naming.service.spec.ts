import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type { FixtureNameQuery } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FixtureExportNaming } from './fixture-export-naming.service.ts';
import type { StudioEngine } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';
import { studioEngineMock } from '../test/mocks/studio-engine.mock.ts';

const QUERY: FixtureNameQuery = { method: 'GET', url: 'v1/invoices/in_1', subdirectory: '' };

describe('FEATURE: fixture export naming', (): void => {
  let engine: StudioEngine;
  let naming: FixtureExportNaming;

  beforeEach((): void => {
    localStorage.clear();
    engine = studioEngineMock();
    const engineProvider: Provider = { provide: STUDIO_ENGINE, useValue: engine };

    TestBed.configureTestingModule({ providers: [engineProvider] });
    naming = TestBed.inject(FixtureExportNaming);
  });

  it('GIVEN a subdirectory WHEN remembered THEN the naming offers it', (): void => {
    naming.rememberSubdirectory('billing');

    expect(naming.subdirectory()).toBe('billing');
  });

  it('GIVEN the API names the fixture WHEN asked THEN resolves the hashed file name', async (): Promise<void> => {
    vi.mocked(engine.fixtureName).mockResolvedValue({ fileName: 'hash.json' });

    const fileName = await naming.fileName(QUERY, new AbortController().signal);

    expect(fileName).toBe('hash.json');
  });
});
