import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';

import type {
  AiFillBody,
  AiModelsResult,
  AiPromptBody,
  AiPromptResult,
  AiTool,
  AiToolsResult,
  DiffBody,
  DiffResult,
  EnvelopeBody,
  EnvelopeResult,
  GenerateBody,
  GenerateResult,
  LoadSpecBody,
  LoadedSpec,
  MergeBody,
  MergeResult
} from '@fixture-automation/fixture-studio-api/contract';

import { untilAborted } from './http-studio-call.ts';
import { readFillStream } from './http-studio-stream.ts';
import type { EngineCall, EngineStreamCall, StudioEngine } from '../common/engine.type.ts';
import { CLI_MODELS_URL, CLI_TOOLS_URL, SPECS_URL } from '../common/studio-api.const.ts';
import { specActionUrl } from '../utils/api-route.util.ts';

/** `StudioEngine` backed by the Fixture Studio API under `/api`. */
@Service({ autoProvided: false })
export class HttpStudioEngine implements StudioEngine {
  private readonly http = inject(HttpClient);

  public async loadSpec(body: LoadSpecBody, call: EngineCall): Promise<LoadedSpec> {
    return untilAborted(this.http.post<LoadedSpec>(SPECS_URL, body), call.signal);
  }

  public async generate(specId: string, body: GenerateBody, call: EngineCall): Promise<GenerateResult> {
    return untilAborted(this.http.post<GenerateResult>(specActionUrl(specId, 'generate'), body), call.signal);
  }

  public async diff(specId: string, body: DiffBody, call: EngineCall): Promise<DiffResult> {
    return untilAborted(this.http.post<DiffResult>(specActionUrl(specId, 'diff'), body), call.signal);
  }

  public async envelope(specId: string, body: EnvelopeBody, call: EngineCall): Promise<EnvelopeResult> {
    return untilAborted(this.http.post<EnvelopeResult>(specActionUrl(specId, 'envelope'), body), call.signal);
  }

  public async merge(specId: string, body: MergeBody, call: EngineCall): Promise<MergeResult> {
    return untilAborted(this.http.post<MergeResult>(specActionUrl(specId, 'merge'), body), call.signal);
  }

  public async aiPrompt(specId: string, body: AiPromptBody, call: EngineCall): Promise<AiPromptResult> {
    return untilAborted(this.http.post<AiPromptResult>(specActionUrl(specId, 'aiPrompt'), body), call.signal);
  }

  public async cliModels(tool: AiTool, call: EngineCall): Promise<AiModelsResult> {
    const params = { tool };

    return untilAborted(this.http.get<AiModelsResult>(CLI_MODELS_URL, { params }), call.signal);
  }

  public async cliTools(call: EngineCall): Promise<AiToolsResult> {
    return untilAborted(this.http.get<AiToolsResult>(CLI_TOOLS_URL), call.signal);
  }

  public async cliFill(specId: string, body: AiFillBody, call: EngineStreamCall): Promise<Record<string, unknown>> {
    const events$ = this.http.post(specActionUrl(specId, 'aiFill'), body, { observe: 'events', reportProgress: true, responseType: 'text' });

    return readFillStream(events$, call);
  }
}
