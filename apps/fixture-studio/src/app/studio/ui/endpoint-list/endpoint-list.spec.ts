import type { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';

import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EndpointList } from './endpoint-list.ts';
import type { EndpointGroup } from '../../common/studio.type.ts';
import { ENDPOINT_STUB } from '../../test/stubs/studio.stub.ts';
import { hostOf } from '../../test/utils/fixture-dom.spec.util.ts';

const SUPPORTED: Endpoint = { ...ENDPOINT_STUB };
const UNSUPPORTED: Endpoint = {
  ...ENDPOINT_STUB,
  id: 'GET /v1/files',
  path: '/v1/files',
  schemaName: null,
  unsupportedReason: 'Response is not JSON'
};
const INVOICES: EndpointGroup = { tag: 'Invoices', endpoints: [SUPPORTED, UNSUPPORTED] };

describe('FEATURE: EndpointList', (): void => {
  let fixture: ComponentFixture<EndpointList>;
  let loader: HarnessLoader;

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(EndpointList);
    fixture.componentRef.setInput('groups', [INVOICES]);
    fixture.componentRef.setInput('selectedIds', new Set([SUPPORTED.id]));
    loader = TestbedHarnessEnvironment.loader(fixture);
    await fixture.whenStable();
  });

  describe('GIVEN a group with a supported and an unsupported endpoint', (): void => {
    it('WHEN rendered THEN shows the tag with its endpoint count', (): void => {
      const host = hostOf(fixture);

      expect(host.querySelector('h3')?.textContent).toContain('Invoices');
      expect(host.querySelector('.endpoint-list__tag-count')?.textContent).toBe('2');
    });

    it('WHEN rendered THEN checks the selected endpoint', async (): Promise<void> => {
      const [supported] = await loader.getAllHarnesses(MatCheckboxHarness);

      expect(await supported?.isChecked()).toBe(true);
    });

    it('WHEN rendered THEN disables the unsupported endpoint and shows why', async (): Promise<void> => {
      const [, unsupported] = await loader.getAllHarnesses(MatCheckboxHarness);

      expect(await unsupported?.isDisabled()).toBe(true);
      expect(await unsupported?.getLabelText()).toContain('Response is not JSON');
    });

    it('WHEN a supported row is clicked THEN emits its id', async (): Promise<void> => {
      const toggled = vi.fn<(id: string) => void>();
      const [supported] = await loader.getAllHarnesses(MatCheckboxHarness);

      fixture.componentInstance.toggled.subscribe(toggled);
      await supported?.toggle();

      expect(toggled).toHaveBeenCalledWith(SUPPORTED.id);
    });
  });
});
