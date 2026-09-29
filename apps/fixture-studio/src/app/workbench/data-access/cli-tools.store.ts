import { Service, inject } from '@angular/core';

import type { AiToolsResult } from '@fixture-automation/fixture-studio-api/contract';

import type { EngineCall } from '../../shared/studio-engine/common/engine.type.ts';
import { STUDIO_ENGINE } from '../../shared/studio-engine/common/studio-engine.token.ts';

/** Which CLIs the API found on its `PATH`, shared by every endpoint tab: asked once per session, and again after a failure. */
@Service()
export class CliToolsStore {
  private readonly engine = inject(STUDIO_ENGINE);
  private check: Promise<AiToolsResult> | undefined;

  public async tools(): Promise<AiToolsResult> {
    if (this.check !== undefined) return this.check;

    const check = this.load();

    this.check = check;

    return check;
  }

  /** Shared by every tab, so no single tab's abort may cancel it. */
  private async load(): Promise<AiToolsResult> {
    const call: EngineCall = { signal: new AbortController().signal };

    try {
      return await this.engine.cliTools(call);
    } catch (error) {
      this.check = undefined;

      throw error;
    }
  }
}
