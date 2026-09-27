import { parentPort } from 'node:worker_threads';

import { runSpecTask } from './spec-task.client.ts';
import type { SpecTask } from '../common/studio-server.type.ts';

const onTask = async (task: SpecTask): Promise<void> => {
  const outcome = await runSpecTask(task);

  parentPort?.postMessage(outcome);
};

const onMessage = (task: SpecTask): void => {
  void onTask(task);
};

parentPort?.once('message', onMessage);
parentPort?.postMessage('ready');
