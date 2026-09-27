import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { describe, expect, it } from 'vitest';

import { provideHttpStudioEngine } from './studio-engine.provider.ts';
import { HttpStudioEngine } from '../data-access/http-studio.engine.ts';
import { STUDIO_ENGINE } from '../data-access/studio-engine.token.ts';

describe('FEATURE: studio engine provider', (): void => {
  it('GIVEN the HTTP provider WHEN the port is injected THEN it is the HTTP engine', (): void => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpStudioEngine()] });

    const engine = TestBed.inject(STUDIO_ENGINE);

    expect(engine).toBeInstanceOf(HttpStudioEngine);
  });
});
