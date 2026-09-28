/**
 * Set by `node --watch` / `--watch-path` in the dev server: every module a worker then loads posts
 * `{ 'watch:import': [...] }` on the worker's message channel, ahead of the spec task outcome.
 * The serve target watches directories, so workers need not report.
 */
const WATCH_REPORT_VARIABLE = 'WATCH_REPORT_DEPENDENCIES';

const isWorkerVariable = ([name]: [string, string | undefined]): boolean => name !== WATCH_REPORT_VARIABLE;

/** The environment for a spec worker: the parent's, minus the watch-mode dependency reporting switch. */
export const workerEnv = (env: Record<string, string | undefined>): Record<string, string | undefined> => {
  const variables = Object.entries(env).filter(isWorkerVariable);

  return Object.fromEntries(variables);
};
