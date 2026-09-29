import { parentPort } from 'node:worker_threads';

import type { SpecTask } from '../common/spec-compute.type.ts';
import { runSpecTask } from '../domain-logic/spec-task.ts';

const onTask = async (task: SpecTask): Promise<void> => {
  const outcome = await runSpecTask(task);

  parentPort?.postMessage(outcome);
};

const onMessage = (task: SpecTask): void => {
  void onTask(task);
};

parentPort?.once('message', onMessage);
parentPort?.postMessage('ready');
