import { Service, computed, inject, resource } from '@angular/core';
import type { ResourceRef, Signal, WritableSignal } from '@angular/core';

import type {
  AiFillProgressEvent,
  AiModelsResult,
  AiTool,
  AiToolStatus,
  AiToolsResult,
  ApiErrorBody,
  MergeResult
} from '@fixture-automation/fixture-studio-api/contract';

import { FillProgress } from './fill-progress.service.ts';
import { OnDeviceAi } from './on-device-ai.service.ts';
import { toApiError } from '../../shared/api-error/utils/api-error.util.ts';
import { parseJsonOrUndefined } from '../../shared/json/utils/json.util.ts';
import { CLI_TOOLS } from '../common/ai-fill.const.ts';
import type { AiFillContext, AiFillForm, AiProviderId, AiRunRequest } from '../common/ai-fill.type.ts';
import type { DiffRequest } from '../common/comparison.type.ts';
import { AiFillStore } from '../data-access/ai-fill.store.ts';
import { CliModelsStore } from '../data-access/cli-models.store.ts';
import { CliToolsStore } from '../data-access/cli-tools.store.ts';
import { ComparisonStore } from '../data-access/comparison.store.ts';
import { installedChoice, installedTools, uncheckedTool } from '../utils/cli-tools.util.ts';

const optionalText = (text: string): string | undefined => {
  const trimmed = text.trim();

  return trimmed === '' ? undefined : trimmed;
};

/** Offered while the install check has no answer: every tool, none marked missing. */
const UNCHECKED_TOOLS = CLI_TOOLS.map(uncheckedTool);

/** Fills a compared fixture's missing properties with AI, then merges and validates the answer. */
@Service({ autoProvided: false })
export class FixtureAiFill {
  private readonly store = inject(AiFillStore);
  private readonly comparison = inject(ComparisonStore);
  private readonly cliModels = inject(CliModelsStore);
  private readonly cliTools = inject(CliToolsStore);
  private readonly onDevice = inject(OnDeviceAi);
  private readonly progress = inject(FillProgress);

  public readonly form: WritableSignal<AiFillForm> = this.store.form;
  public readonly log: Signal<AiFillProgressEvent[]> = this.store.log.asReadonly();

  /** On-device AI when the user opted in and Chrome can run it; the local CLI otherwise. */
  public readonly provider: Signal<AiProviderId> = this.onDevice.provider;

  private readonly isAwaitingChrome: Signal<boolean> = this.onDevice.isAwaitingChrome;
  private readonly isAwaitingModel: Signal<boolean> = this.onDevice.isAwaitingModel;

  /** The CLI checks (install, models) are only worth asking once the CLI is the settled choice. */
  private readonly isCliSettled: Signal<boolean> = computed(() => {
    if (this.isAwaitingChrome()) return false;

    return this.provider() === 'cli';
  });

  /** Which CLIs the API found; the answer also moves the form off a tool that is not installed. */
  private readonly tools: ResourceRef<AiToolsResult | undefined> = resource({
    params: () => (this.isCliSettled() ? true : undefined),
    loader: async (): Promise<AiToolsResult> => this.checkTools()
  });

  /** The installed tools, or `undefined` while the check has no answer (not asked, loading, or failed). */
  private readonly knownInstalledTools: Signal<AiTool[] | undefined> = computed(() => {
    if (!this.tools.hasValue()) return undefined;

    return installedTools(this.tools.value().tools);
  });

  public readonly toolOptions: Signal<AiToolStatus[]> = computed(() => {
    if (!this.tools.hasValue()) return UNCHECKED_TOOLS;

    return this.tools.value().tools;
  });

  public readonly isNoCliInstalled: Signal<boolean> = computed(() => this.knownInstalledTools()?.length === 0);

  public readonly isMockAi: Signal<boolean> = computed(() => this.tools.hasValue() && this.tools.value().mock);

  /** The chosen tool is known to be missing; a failed check blocks nothing. */
  private readonly isToolMissing: Signal<boolean> = computed(() => {
    const installed = this.knownInstalledTools();

    if (installed === undefined) return false;

    return !installed.includes(this.form().tool);
  });

  /** The tool whose models to list: only a settled, checked CLI that is not known to be missing. */
  private readonly modelsTool: Signal<AiTool | undefined> = computed(() => {
    if (!this.isCliSettled()) return undefined;

    const isCheckingTools = this.tools.isLoading();

    if (isCheckingTools) return undefined;

    if (this.isToolMissing()) return undefined;

    return this.form().tool;
  });

  /** Model discovery can take a while, so it only runs for the CLI provider, once per tool across tabs. */
  public readonly models: ResourceRef<AiModelsResult | undefined> = resource({
    params: () => this.modelsTool(),
    loader: async ({ params }): Promise<AiModelsResult> => this.cliModels.modelsOf(params)
  });

  public readonly modelOptions: Signal<string[]> = computed(() => {
    if (!this.models.hasValue()) return [];

    return this.models.value().models;
  });

  public readonly modelsError: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.models.error()));

  public readonly isRunning: Signal<boolean> = this.progress.isRunning;
  public readonly runError: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.store.run.error()));
  public readonly isMerging: Signal<boolean> = this.store.merge.isLoading;
  public readonly mergeError: Signal<ApiErrorBody | undefined> = computed(() => toApiError(this.store.merge.error()));

  public readonly mergeResult: Signal<MergeResult | undefined> = this.progress.mergeResult;

  /** A fill needs a diff with at least one missing or replaced path, and a settled provider. */
  public readonly canRun: Signal<boolean> = computed(() => {
    if (!this.comparison.diff.hasValue()) return false;

    if (this.isAwaitingChrome()) return false;

    if (this.isAwaitingModel()) return false;

    if (this.isToolMissing()) return false;

    const hasMissing = this.comparison.diff.value().missingPaths.length > 0;

    return hasMissing && !this.isRunning();
  });

  /**
   * Endpoint and envelope come from the compared request, not the live form, and the fixture is the diff's
   * baseline: merge only fills absent keys, so a replaced value must already be gone from what it merges onto.
   */
  public run(): void {
    const compared = this.comparison.compared();

    if (compared === undefined) return;

    const context = this.contextFor(compared);

    if (context === undefined) return;

    const request: AiRunRequest = { provider: this.provider(), context, objectShape: compared.body.objectShape };

    this.store.start(request);
  }

  public cancel(): void {
    this.store.cancel();
  }

  /** The models store already forgot the failed discovery, so reloading asks the CLI again. */
  public retryModels(): void {
    this.models.reload();
  }

  private async checkTools(): Promise<AiToolsResult> {
    const result = await this.cliTools.tools();
    const form = this.form();
    const tool = installedChoice(result.tools, form.tool);

    if (tool !== form.tool) this.form.set({ ...form, tool });

    return result;
  }

  private contextFor(compared: DiffRequest): AiFillContext | undefined {
    if (!this.comparison.diff.hasValue()) return undefined;

    const form = this.form();
    const { baseline, missing, completeJson } = this.comparison.diff.value();
    const context: AiFillContext = {
      specId: compared.specId,
      endpointId: compared.body.endpointId,
      fixture: baseline,
      missing,
      complete: parseJsonOrUndefined(completeJson),
      scenario: optionalText(form.scenario),
      tool: form.tool,
      model: optionalText(form.model)
    };

    return context;
  }
}
