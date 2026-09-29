import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { beforeEach, describe, expect, it } from 'vitest';

import { FileDrop } from './file-drop.ts';
import { requiredElement, textAt } from '../../../../test/utils/fixture-dom.spec.util.ts';

describe('FEATURE: FileDrop', (): void => {
  let fixture: ComponentFixture<FileDrop>;
  let picked: File[];

  beforeEach(async (): Promise<void> => {
    fixture = TestBed.createComponent(FileDrop);
    fixture.componentRef.setInput('heading', 'Drop a fixture');
    fixture.componentRef.setInput('hint', 'read locally');
    fixture.componentRef.setInput('accept', '.json');
    picked = [];
    fixture.componentInstance.picked.subscribe((file): number => picked.push(file));
    await fixture.whenStable();
  });

  it('GIVEN inputs WHEN rendered THEN labels the picker and limits the file types', (): void => {
    expect(textAt(fixture, '.drop__title')).toBe('Drop a fixture');
    expect(requiredElement(fixture, 'input').getAttribute('accept')).toBe('.json');
  });

  it('GIVEN inputs WHEN rendered THEN names the picker by its heading and describes it by the hint', (): void => {
    const input = requiredElement(fixture, 'input');

    expect(input.getAttribute('aria-label')).toBe('Drop a fixture');
    expect(input.getAttribute('aria-description')).toBe('read locally');
  });

  it('GIVEN a picked file WHEN the input changes THEN emits it and resets the input', (): void => {
    const input = requiredElement(fixture, 'input');
    const file = new File(['{}'], 'a.json');

    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new Event('change'));

    expect(picked).toStrictEqual([file]);
  });

  it('GIVEN a change without a file WHEN handled THEN emits nothing', (): void => {
    const input = requiredElement(fixture, 'input');

    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new Event('change'));

    expect(picked).toStrictEqual([]);
  });

  it('GIVEN a dropped file WHEN dropped THEN emits it', (): void => {
    const file = new File(['{}'], 'b.json');
    const drop = new Event('drop', { cancelable: true });
    const dataTransfer = { files: [file] };

    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer });
    requiredElement(fixture, '.drop').dispatchEvent(drop);

    expect(picked).toStrictEqual([file]);
    expect(drop.defaultPrevented).toBe(true);
  });

  it('GIVEN a drag over the zone WHEN it leaves THEN drops the highlight', async (): Promise<void> => {
    const zone = requiredElement(fixture, '.drop');

    zone.dispatchEvent(new Event('dragover', { cancelable: true }));
    await fixture.whenStable();
    const isHighlighted = zone.classList.contains('drop--active');

    zone.dispatchEvent(new Event('dragleave'));
    await fixture.whenStable();

    expect(isHighlighted).toBe(true);
    expect(zone.classList.contains('drop--active')).toBe(false);
  });
});
