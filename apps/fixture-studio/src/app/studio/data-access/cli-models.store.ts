import { Service, inject } from '@angular/core';

import type { AiModelsResult, AiTool } from '@fixture-automation/fixture-studio-api/contract';

import { STUDIO_ENGINE } from './studio-engine.token.ts';
import type { EngineCall } from '../common/engine.type.ts';

/**
 * Model lists per CLI, shared by every endpoint tab. Discovery holds one of the API's two CLI slots
 * for up to two minutes, so each tool is asked once per session; a failed discovery is asked again.
 */
@Service()
export class CliModelsStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private readonly discoveries = new Map<AiTool, Promise<AiModelsResult>>();

  public async modelsOf(tool: AiTool): Promise<AiModelsResult> {
    const known = this.discoveries.get(tool);

    if (known !== undefined) return known;

    const discovery = this.discover(tool);

    this.discoveries.set(tool, discovery);

    return discovery;
  }

  /** Shared by every tab, so no single tab's abort may cancel it. */
  private async discover(tool: AiTool): Promise<AiModelsResult> {
    const call: EngineCall = { signal: new AbortController().signal };

    try {
      return await this.engine.cliModels(tool, call);
    } catch (error) {
      this.discoveries.delete(tool);

      throw error;
    }
  }
}
