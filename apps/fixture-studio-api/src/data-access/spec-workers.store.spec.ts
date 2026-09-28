import { once } from 'node:events';
import { Worker } from 'node:worker_threads';

import { afterEach, describe, expect, it } from 'vitest';

import { SpecWorkers } from './spec-workers.store.ts';

const READY_SOURCE = "const { parentPort } = require('node:worker_threads'); setInterval(() => {}, 1000); parentPort.postMessage('ready');";
const CRASH_SOURCE = "throw new Error('boot failed');";

describe('FEATURE: spec workers', (): void => {
  const spawned: Worker[] = [];

  const spawnFrom = (sources: string[]): (() => Worker) => {
    const spawn = (): Worker => {
      const source = sources.shift() ?? READY_SOURCE;
      const worker = new Worker(source, { eval: true });

      spawned.push(worker);

      return worker;
    };

    return spawn;
  };

  afterEach(async (): Promise<void> => {
    const terminations = spawned.splice(0).map(async (worker: Worker): Promise<number> => worker.terminate());

    await Promise.all(terminations);
  });

  describe('GIVEN no spare yet', (): void => {
    it('WHEN a worker is taken THEN it gets a fresh ready worker and a spare starts loading behind it', async (): Promise<void> => {
      const workers = new SpecWorkers(spawnFrom([]));

      const worker = await workers.take();

      expect(worker).toBe(spawned[0]);
      expect(spawned).toHaveLength(2);
    });
  });

  describe('GIVEN a warmed pool', (): void => {
    it('WHEN a worker is taken THEN it is the warmed spare, and a new spare replaces it', async (): Promise<void> => {
      const workers = new SpecWorkers(spawnFrom([]));

      workers.warm();
      workers.warm();

      const worker = await workers.take();

      expect(worker).toBe(spawned[0]);
      expect(spawned).toHaveLength(2);
    });

    it('WHEN it is closed THEN the spare is terminated and warming starts nothing new', async (): Promise<void> => {
      const workers = new SpecWorkers(spawnFrom([]));

      workers.warm();
      const [spare] = spawned;

      if (spare === undefined) throw new Error('warm() spawned no spare');

      const exited = once(spare, 'exit');

      await workers.close();
      await exited;
      workers.warm();

      expect(spawned).toHaveLength(1);
    });
  });

  describe('GIVEN a worker that posts another message before ready, as watch mode does', (): void => {
    it('WHEN it is taken THEN the take waits for ready, leaving the later messages to the task', async (): Promise<void> => {
      const statements = [
        "const { parentPort } = require('node:worker_threads');",
        "parentPort.postMessage({ 'watch:import': ['node:worker_threads'] });",
        "parentPort.postMessage('ready');",
        "parentPort.postMessage('after ready');",
        'setInterval(() => {}, 1000);'
      ];
      const noisy = statements.join(' ');
      const workers = new SpecWorkers(spawnFrom([noisy]));

      const worker = await workers.take();

      const messages: unknown[] = await once(worker, 'message');
      const [nextMessage] = messages;

      expect(nextMessage).toBe('after ready');
    });
  });

  describe('GIVEN a worker that fails to start', (): void => {
    it('WHEN it is taken THEN the take rejects, and the next take gets the spare that loaded fine', async (): Promise<void> => {
      const workers = new SpecWorkers(spawnFrom([CRASH_SOURCE]));

      const failedTake = workers.take();

      await expect(failedTake).rejects.toThrow('boot failed');

      const worker = await workers.take();

      expect(worker).toBe(spawned[1]);
    });
  });

  describe('GIVEN a closed pool', (): void => {
    it('WHEN a worker is taken THEN it is still a fresh ready worker, with no spare behind it', async (): Promise<void> => {
      const workers = new SpecWorkers(spawnFrom([]));

      await workers.close();

      const worker = await workers.take();

      expect(worker).toBe(spawned[0]);
      expect(spawned).toHaveLength(1);
    });
  });
});
