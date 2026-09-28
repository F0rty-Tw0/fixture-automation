import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import { workerEnv } from '../utils/worker-env.util.ts';

/** Running from `src` (type stripping) resolves the workspace packages to their sources too; `dist` inherits the parent's flags. */
const MODULE_EXTENSION = extname(fileURLToPath(import.meta.url));
const WORKER_URL = new URL(`./spec-compute.worker${MODULE_EXTENSION}`, import.meta.url);
const SOURCE_EXEC_ARGV = ['--conditions=@fixture-automation/source'];
const MAX_HEAP_MB = 512;
const READY = 'ready';

const spawnWorker = (): Worker => {
  const resourceLimits = { maxOldGenerationSizeMb: MAX_HEAP_MB };
  const env = workerEnv(process.env);
  const isSource = MODULE_EXTENSION === '.ts';
  const sourceOptions = { env, execArgv: SOURCE_EXEC_ARGV, resourceLimits };
  const distOptions = { env, resourceLimits };
  const worker = new Worker(WORKER_URL, isSource ? sourceOptions : distOptions);

  worker.unref();

  return worker;
};

type WorkerSpawn = () => Worker;

/** A worker that has loaded its modules (about 1-2 s from source) and posted `ready`; any other message before it is ignored. */
const readyWorker = async (spawn: WorkerSpawn): Promise<Worker> => {
  const worker = spawn();

  const ready = new Promise<Worker>((resolve, reject): void => {
    const onError = (error: Error): void => reject(error);
    const onExit = (code: number): void => reject(new Error(`spec worker exited with code ${code} while starting`));
    const onMessage = (message: unknown): void => {
      if (message !== READY) return;

      worker.off('message', onMessage);
      worker.off('error', onError);
      worker.off('exit', onExit);
      resolve(worker);
    };

    worker.on('message', onMessage);
    worker.once('error', onError);
    worker.once('exit', onExit);
  });

  return ready;
};

/** Hands out one fresh, already-loaded worker per spec task and starts loading the next one right away; one spare at most. */
export class SpecWorkers {
  private readonly spawn: WorkerSpawn;
  private spare: Promise<Worker> | undefined;
  private isClosed = false;

  /** `spawn` starts the real spec worker; tests pass a stand-in. */
  public constructor(spawn: WorkerSpawn = spawnWorker) {
    this.spawn = spawn;
  }

  /** A loaded worker for one task; after `close()` it is still fresh, but no spare is started behind it. */
  public async take(): Promise<Worker> {
    const worker = this.spare ?? readyWorker(this.spawn);

    this.spare = undefined;
    this.refill();

    return worker;
  }

  /** Starts loading the first spare, so the first request does not pay the start-up. */
  public warm(): void {
    if (this.spare === undefined) this.refill();
  }

  public async close(): Promise<void> {
    const { spare } = this;

    this.isClosed = true;
    this.spare = undefined;

    if (spare === undefined) return;

    const worker = await spare.catch((): undefined => undefined);

    await worker?.terminate();
  }

  /** Starts the next spare; a failed start stays silent until a request takes it. */
  private refill(): void {
    if (this.isClosed) return;

    const spare = readyWorker(this.spawn);

    void spare.catch((): undefined => undefined);
    this.spare = spare;
  }
}
