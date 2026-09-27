import type {
  AiFillEvent,
  AiModelsResult,
  AiPromptResult,
  AiToolsResult,
  DiffResult,
  MergeResult
} from '@fixture-automation/fixture-studio-api/contract';
import type { Route } from '@playwright/test';

import type { RecordingRoute } from '../common/playwright.type.ts';
import {
  AI_MODELS_STUB,
  AI_PROMPT_STUB,
  AI_TOOLS_STUB,
  DIFF_RESULT_STUB,
  FILL_EVENTS_STUB,
  MERGE_RESULT_STUB
} from '../stubs/workbench.stub.ts';
import { ndjsonOf } from '../utils/ndjson.spec.util.ts';
import { recordingRoute } from '../utils/recording-route.spec.util.ts';

const NDJSON = 'application/x-ndjson';

export const diffMock = (result: DiffResult = DIFF_RESULT_STUB): RecordingRoute => recordingRoute(result);

export const mergeMock = (result: MergeResult = MERGE_RESULT_STUB): RecordingRoute => recordingRoute(result);

export const aiPromptMock = (result: AiPromptResult = AI_PROMPT_STUB): RecordingRoute => recordingRoute(result);

export const cliModelsMock = (result: AiModelsResult = AI_MODELS_STUB): RecordingRoute => recordingRoute(result);

export const cliToolsMock = (result: AiToolsResult = AI_TOOLS_STUB): RecordingRoute => recordingRoute(result);

/** The whole `ai-fill` stream in one response; chunked delivery is the stream server's job. */
export const aiFillMock = (events: AiFillEvent[] = FILL_EVENTS_STUB): RecordingRoute => {
  const bodies: unknown[] = [];
  const body = ndjsonOf(events);

  const handler = async (route: Route): Promise<void> => {
    const sent: unknown = route.request().postDataJSON();

    bodies.push(sent);

    return route.fulfill({ body, contentType: NDJSON });
  };

  const recording: RecordingRoute = { handler, bodies };

  return recording;
};
