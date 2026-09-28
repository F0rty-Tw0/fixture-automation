import { HttpEventType } from '@angular/common/http';
import type { HttpTestingController } from '@angular/common/http/testing';
import type { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import type {
  AiFillBody,
  AiFillProgressEvent,
  AiModelsResult,
  AiPromptBody,
  ApiErrorBody,
  DiffBody,
  GenerateBody,
  GenerateResult,
  LoadSpecBody,
  MergeBody
} from '@fixture-automation/fixture-studio-api/contract';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { HttpStudioEngine } from './http-studio.engine.ts';
import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { EngineCall, EngineStreamCall, StudioEngine  } from '../common/engine.type.ts';
import {
  AI_PROMPT_RESULT_STUB,
  CLI_TOOLS_RESULT_STUB,
  DIFF_RESULT_STUB,
  GENERATED_FIXTURE_STUB,
  LOADED_SPEC_STUB,
  MERGE_RESULT_STUB,
  MISSING_FILE_STUB
} from '../test/stubs/studio.stub.ts';
import { rejectionOf } from '../test/utils/promise.spec.util.ts';
import { configureStudioHttp } from '../test/utils/studio-http.spec.util.ts';

const HTTP_ENGINE: Provider = { provide: STUDIO_ENGINE, useClass: HttpStudioEngine };
const URL_SOURCE: LoadSpecBody = { url: 'https://example.com/openapi.json' };
const GENERATE_BODY: GenerateBody = { endpointIds: ['GET /v1/invoices'], formats: ['json'], requiredOnly: false };
const GENERATE_RESULT: GenerateResult = { fixtures: [GENERATED_FIXTURE_STUB] };
const FIXTURE = { id: 'in_1' };
const DIFF_BODY: DiffBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, requiredOnly: false };
const POPULATED = { status: 'open' };
const MERGE_BODY: MergeBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, populated: POPULATED };
const PROMPT_BODY: AiPromptBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, missing: MISSING_FILE_STUB };
const FILL_BODY: AiFillBody = { endpointId: 'GET /v1/invoices', fixture: FIXTURE, missing: MISSING_FILE_STUB, tool: 'claude' };
const MODELS: AiModelsResult = { models: ['mock-model'], source: 'mock' };

describe('FEATURE: HttpStudioEngine', (): void => {
  let http: HttpTestingController;
  let engine: StudioEngine;
  let call: EngineCall;

  beforeEach((): void => {
    http = configureStudioHttp(HTTP_ENGINE);
    engine = TestBed.inject(STUDIO_ENGINE);
    call = { signal: new AbortController().signal };
  });

  afterEach((): void => {
    http.verify();
  });

  describe('SCENARIO: request and response calls', (): void => {
    it('GIVEN a spec load WHEN the API answers THEN posts the source and resolves the spec', async (): Promise<void> => {
      const loading = engine.loadSpec(URL_SOURCE, call);
      const request = http.expectOne('/api/specs');

      request.flush(LOADED_SPEC_STUB);

      expect(request.request.body).toStrictEqual(URL_SOURCE);
      await expect(loading).resolves.toStrictEqual(LOADED_SPEC_STUB);
    });

    it('GIVEN a generate call WHEN the API answers THEN posts to the encoded spec route', async (): Promise<void> => {
      const generating = engine.generate('spec 1', GENERATE_BODY, call);

      http.expectOne('/api/specs/spec%201/generate').flush(GENERATE_RESULT);

      await expect(generating).resolves.toStrictEqual(GENERATE_RESULT);
    });

    it('GIVEN a diff call WHEN the API answers THEN resolves the diff', async (): Promise<void> => {
      const diffing = engine.diff('spec-1', DIFF_BODY, call);
      const request = http.expectOne('/api/specs/spec-1/diff');

      request.flush(DIFF_RESULT_STUB);

      expect(request.request.body).toStrictEqual(DIFF_BODY);
      await expect(diffing).resolves.toStrictEqual(DIFF_RESULT_STUB);
    });

    it('GIVEN a merge call WHEN the API answers THEN resolves the merge', async (): Promise<void> => {
      const merging = engine.merge('spec-1', MERGE_BODY, call);

      http.expectOne('/api/specs/spec-1/merge').flush(MERGE_RESULT_STUB);

      await expect(merging).resolves.toStrictEqual(MERGE_RESULT_STUB);
    });

    it('GIVEN an AI prompt call WHEN the API answers THEN resolves the prompt', async (): Promise<void> => {
      const prompting = engine.aiPrompt('spec-1', PROMPT_BODY, call);

      http.expectOne('/api/specs/spec-1/ai-prompt').flush(AI_PROMPT_RESULT_STUB);

      await expect(prompting).resolves.toStrictEqual(AI_PROMPT_RESULT_STUB);
    });

    it('GIVEN a tool WHEN its models are listed THEN queries by tool', async (): Promise<void> => {
      const listing = engine.cliModels('codex', call);

      http.expectOne('/api/ai/cli/models?tool=codex').flush(MODELS);

      await expect(listing).resolves.toStrictEqual(MODELS);
    });

    it('GIVEN the API WHEN the CLI tools are listed THEN resolves the install check', async (): Promise<void> => {
      const listing = engine.cliTools(call);

      http.expectOne('/api/ai/cli/tools').flush(CLI_TOOLS_RESULT_STUB);

      await expect(listing).resolves.toStrictEqual(CLI_TOOLS_RESULT_STUB);
    });
  });

  describe('SCENARIO: failures and cancellation', (): void => {
    it('GIVEN the API rejects WHEN called THEN rejects with its message and fix, keeping the HTTP error as cause', async (): Promise<void> => {
      const body: ApiErrorBody = { message: 'spec not found', fix: 'Reload the spec.' };
      const diffing = engine.diff('spec-1', DIFF_BODY, call);

      http.expectOne('/api/specs/spec-1/diff').flush(body, { status: 404, statusText: 'Not Found' });
      const error = await rejectionOf(diffing);

      expect(error).toHaveProperty('message', 'spec not found');
      expect(error).toHaveProperty('fix', 'Reload the spec.');
      expect(error).toHaveProperty('cause.status', 404);
    });

    it('GIVEN a CLI fill WHEN the API refuses it THEN rejects with the message and fix from its text body', async (): Promise<void> => {
      const body: ApiErrorBody = { message: 'too many AI CLI runs at once', fix: 'Wait for a run to finish, then retry.' };
      const streamCall: EngineStreamCall = { signal: call.signal, onProgress: (): void => undefined };
      const filling = engine.cliFill('spec-1', FILL_BODY, streamCall);

      http.expectOne('/api/specs/spec-1/ai-fill').flush(JSON.stringify(body), { status: 429, statusText: 'Too Many Requests' });
      const error = await rejectionOf(filling);

      expect(error).toHaveProperty('message', body.message);
      expect(error).toHaveProperty('fix', body.fix);
    });

    it('GIVEN a call in flight WHEN aborted THEN cancels the request and rejects with the reason', async (): Promise<void> => {
      const controller = new AbortController();
      const merging = engine.merge('spec-1', MERGE_BODY, { signal: controller.signal });
      const request = http.expectOne('/api/specs/spec-1/merge');

      controller.abort('user');
      const reason = await rejectionOf(merging);

      expect(reason).toBe('user');
      expect(request.cancelled).toBe(true);
    });
  });

  it('GIVEN a CLI fill WHEN the stream answers THEN reports progress and resolves the populated values', async (): Promise<void> => {
    const progress: AiFillProgressEvent[] = [];
    const streamCall: EngineStreamCall = { signal: call.signal, onProgress: (event): number => progress.push(event) };
    const filling = engine.cliFill('spec-1', FILL_BODY, streamCall);
    const request = http.expectOne('/api/specs/spec-1/ai-fill');
    const text = '{"type":"progress","stream":"status","text":"started"}\n{"type":"result","populated":{"status":"open"}}\n';

    request.event({ type: HttpEventType.DownloadProgress, loaded: text.length, partialText: text });

    await expect(filling).resolves.toStrictEqual(POPULATED);
    expect(progress.map((event) => event.text)).toStrictEqual(['started']);
    expect(request.request.reportProgress).toBe(true);
  });
});
