import { styleText } from 'node:util';

import { isMissingFile } from '@fixture-automation/shared';

import { FixtureError } from '../common/fixture.error.ts';
import { errorMessage } from '../utils/error-message.util.ts';

const PARSE_ARGS = 'ERR_PARSE_ARGS';
const MISSING_PATH_FIX = 'create the parent directory, or check the path';

const errorField = (error: unknown, key: string): string => {
  if (!(error instanceof Error)) return '';

  const value: unknown = Reflect.get(error, key);

  if (typeof value !== 'string') return '';

  return value;
};

/** Node's parse errors append a lecture about positional arguments; keep the first sentence. */
const firstSentence = (message: string): string => {
  const [sentence] = message.split('. ');

  return sentence ?? message;
};

const failureMessage = (error: unknown): string => {
  if (!(error instanceof Error)) return errorMessage(error);

  const code = errorField(error, 'code');
  const isParseFailure = code.startsWith(PARSE_ARGS);

  if (isParseFailure) return firstSentence(error.message);

  const path = errorField(error, 'path');
  const isMissing = isMissingFile(error);
  const isMissingPath = isMissing && path !== '';

  if (isMissingPath) return `no such file or directory: ${path}`;

  return error.message;
};

const failureFix = (error: unknown): string | undefined => {
  if (error instanceof FixtureError) return error.fix;

  const isMissing = isMissingFile(error);

  if (isMissing) return MISSING_PATH_FIX;

  return undefined;
};

/**
 * Run a CLI body and turn any failure into at most three stderr lines with exit code 1.
 * A stack trace is never printed; throw a `FixtureError` to add the `fix:` line.
 */
export const runCli = async (tool: string, run: () => Promise<void>): Promise<void> => {
  try {
    await run();
  } catch (error: unknown) {
    const fix = failureFix(error);

    const message = styleText('red', `${tool}: ${failureMessage(error)}`, { stream: process.stderr });

    process.stderr.write(`${message}\n`);

    if (fix !== undefined) {
      const hint = styleText('yellow', `  fix: ${fix}`, { stream: process.stderr });

      process.stderr.write(`${hint}\n`);
    }

    const help = styleText('cyan', `  see: ${tool} --help`, { stream: process.stderr });

    process.stderr.write(`${help}\n`);
    process.exitCode = 1;
  }
};
