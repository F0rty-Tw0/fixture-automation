/**
 * Every built-in tool of Gemini CLI 0.57.0 and 0.59.0 (its `ALL_BUILTIN_TOOL_NAMES`, the two background-process tools
 * `createToolRegistry` also registers, and the browser agent's `take_snapshot`), excluded one by one so the model can
 * read, write, run or fetch nothing.
 * `tools.core: []` would disable them too, but the CLI then sends an empty tool entry that the Gemini API rejects:
 * `400 tools[0].tool_type: required one_of 'tool_type' must have one initialized field`.
 */
export const GEMINI_EXCLUDED_TOOLS = [
  'activate_skill',
  'ask_user',
  'complete_task',
  'enter_plan_mode',
  'exit_plan_mode',
  'get_internal_docs',
  'glob',
  'google_web_search',
  'grep_search',
  'invoke_agent',
  'list_background_processes',
  'list_directory',
  'list_mcp_resources',
  'read_background_output',
  'read_file',
  'read_many_files',
  'read_mcp_resource',
  'replace',
  'run_shell_command',
  'take_snapshot',
  'tracker_add_dependency',
  'tracker_create_task',
  'tracker_get_task',
  'tracker_list_tasks',
  'tracker_update_task',
  'tracker_visualize',
  'update_topic',
  'web_fetch',
  'write_file',
  'write_todos'
];
