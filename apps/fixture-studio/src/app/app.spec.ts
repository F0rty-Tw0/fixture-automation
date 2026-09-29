import { TestBed } from '@angular/core/testing';

import { describe, expect, it } from 'vitest';

import { App } from './app.ts';
import { provideHttpStudioEngine } from './shared/studio-engine/domain-logic/studio-engine.provider.ts';
import { hostOf } from './test/utils/fixture-dom.spec.util.ts';
import { configureStudioHttp } from './test/utils/studio-http.spec.util.ts';

const STUDIO_ENGINE = provideHttpStudioEngine();

describe('FEATURE: App shell', (): void => {
  it('GIVEN the app WHEN rendered THEN hosts the studio page', async (): Promise<void> => {
    configureStudioHttp(STUDIO_ENGINE);
    const fixture = TestBed.createComponent(App);
    const host = hostOf(fixture);

    await fixture.whenStable();

    expect(host.querySelector('fs-studio-page h1')?.textContent).toBe('Fixture Studio');
  });
});
