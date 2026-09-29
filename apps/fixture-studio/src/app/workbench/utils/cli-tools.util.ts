import type { AiTool, AiToolStatus } from '@fixture-automation/fixture-studio-api/contract';

const isInstalled = (status: AiToolStatus): boolean => status.installed;

const toolOf = (status: AiToolStatus): AiTool => status.tool;

/** The installed tools, in the order the install check listed them. */
export const installedTools = (tools: AiToolStatus[]): AiTool[] => {
  const installed = tools.filter(isInstalled);

  return installed.map(toolOf);
};

/** The chosen tool when it is installed or nothing is; otherwise the first installed tool. */
export const installedChoice = (tools: AiToolStatus[], chosen: AiTool): AiTool => {
  const installed = installedTools(tools);
  const [firstInstalled] = installed;
  const isChosenInstalled = installed.includes(chosen);

  if (isChosenInstalled) return chosen;

  return firstInstalled ?? chosen;
};

/** A tool offered before the install check answers: not known to be missing. */
export const uncheckedTool = (tool: AiTool): AiToolStatus => {
  const status: AiToolStatus = { tool, installed: true };

  return status;
};
