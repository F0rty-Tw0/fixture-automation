import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import type { AiFillProgressEvent } from '@fixture-automation/fixture-studio-api/contract';
import { beforeEach, describe, expect, it } from 'vitest';

import { ProgressLog } from './progress-log.ts';
import { hostOf, textAt, textsAt } from '../../../test/utils/fixture-dom.spec.util.ts';

const STDERR: AiFillProgressEvent = { type: 'progress', stream: 'stderr', text: 'warning: slow' };
const STATUS: AiFillProgressEvent = { type: 'progress', stream: 'status', text: 'Cancelled.' };
const ANSWER: AiFillProgressEvent = { type: 'progress', stream: 'stdout', text: '{\n  "memo": "Net 30"\n}' };

describe('FEATURE: ProgressLog', (): void => {
  let fixture: ComponentFixture<ProgressLog>;

  beforeEach((): void => {
    fixture = TestBed.createComponent(ProgressLog);
  });

  it('GIVEN no output WHEN rendered THEN is a labelled live log with a hint', async (): Promise<void> => {
    fixture.componentRef.setInput('lines', []);
    await fixture.whenStable();

    expect(hostOf(fixture).getAttribute('role')).toBe('log');
    expect(hostOf(fixture).getAttribute('aria-label')).toBe('AI progress');
    expect(textAt(fixture, '.log__empty')).toContain('Output appears here');
  });

  it('GIVEN output WHEN rendered THEN shows each line tagged with its stream', async (): Promise<void> => {
    fixture.componentRef.setInput('lines', [STDERR, STATUS]);
    await fixture.whenStable();

    const lineElements = hostOf(fixture).querySelectorAll<HTMLElement>('.log__line');
    const lines = [...lineElements];
    const streams = lines.map((line) => line.dataset['stream']);

    expect(textsAt(fixture, '.log__line')).toStrictEqual(['warning: slow', 'Cancelled.']);
    expect(streams).toStrictEqual(['stderr', 'status']);
  });

  it('GIVEN a streamed answer WHEN rendered THEN shows it as one block, keeping its line breaks', async (): Promise<void> => {
    fixture.componentRef.setInput('lines', [STATUS, ANSWER]);
    await fixture.whenStable();

    const block = hostOf(fixture).querySelector<HTMLElement>('[data-stream="stdout"]');

    expect(block?.textContent).toBe(ANSWER.text);
  });
});
