import type { HttpTestingController, TestRequest } from '@angular/common/http/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';

import { vi } from 'vitest';

import { requiredElement } from '../../../test/utils/fixture-dom.spec.util.ts';

/** The AI fill panel's Fill button. */
export const runButton = <TComponent>(fixture: ComponentFixture<TComponent>): HTMLButtonElement => {
  const button = requiredElement(fixture, '.fill__actions button');

  if (!(button instanceof HTMLButtonElement)) throw new Error('The run button is missing.');

  return button;
};

/** The panel asks once its resources run; retry until the request is sent, then answer it. */
export const answerPanel = async (http: HttpTestingController, url: string, body: object): Promise<void> => {
  const answer = (): void => {
    TestBed.tick();
    http.expectOne(url).flush(body);
  };

  await vi.waitFor(answer);
};

/** The merge starts once the stream's result settles; retry until it is sent. */
export const mergeRequest = async (http: HttpTestingController): Promise<TestRequest> => {
  const expectMerge = (): TestRequest => {
    TestBed.tick();

    return http.expectOne('/api/specs/spec-1/merge');
  };

  return vi.waitFor(expectMerge);
};
