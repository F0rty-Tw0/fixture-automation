import { createInterface } from 'node:readline/promises';
import { styleText } from 'node:util';

import { FixtureError } from '../common/fixture.error.ts';
import type { InputSpec, Inputs, Question } from '../common/input.type.ts';
import { silentInputs } from '../utils/silent-inputs.util.ts';

const PROMPT_ATTEMPTS = 3;
const YES = /^y(es)?$/i;

/** Asks on stderr so a piped stdout keeps only the tool's output. */
export const terminalQuestion: Question = async (prompt: string): Promise<string> => {
  const reader = createInterface({ input: process.stdin, output: process.stderr });
  const styledPrompt = styleText(['bold', 'cyan'], prompt, { stream: process.stderr });

  try {
    return await reader.question(styledPrompt);
  } finally {
    reader.close();
  }
};

const printIntro = (input: InputSpec, hint: string, withExample: boolean): void => {
  const label = styleText(['bold', 'cyan'], input.label, { stream: process.stderr });

  console.error(`${label}${hint}: ${input.description}`);

  if (withExample) console.error(`  e.g. ${input.example}`);
};

/** Inputs for a terminal run: a missing required value opens a prompt session that also asks the unset optionals. */
export const promptedInputs = (question: Question = terminalQuestion): Inputs => {
  let prompted = false;

  const ask = async (input: InputSpec): Promise<string> => {
    const answer = await question(`${input.label}: `);

    return answer.trim();
  };

  const required = async (value: string | undefined, input: InputSpec, usage: string): Promise<string> => {
    if (value) return value;

    prompted = true;
    printIntro(input, '', true);

    for (let attempt = 0; attempt < PROMPT_ATTEMPTS; attempt += 1) {
      const answer = await ask(input);

      if (answer !== '') return answer;

      console.error(styleText('yellow', `${input.label} is required`, { stream: process.stderr }));
    }

    throw new FixtureError(`no ${input.label} given after ${PROMPT_ATTEMPTS} attempts`, usage);
  };

  const optional = async (value: string | undefined, input: InputSpec): Promise<string | undefined> => {
    const isSettled = value !== undefined || !prompted;

    if (isSettled) return value;

    printIntro(input, ' (Enter to skip)', true);

    const answer = await ask(input);

    if (answer === '') return undefined;

    return answer;
  };

  const flag = async (value: boolean | undefined, input: InputSpec): Promise<boolean> => {
    if (value === true) return true;

    if (!prompted) return false;

    printIntro(input, ' (y/N)', false);

    const answer = await ask(input);

    return YES.test(answer);
  };

  const inputs: Inputs = { required, optional, flag };

  return inputs;
};

/** Prompt when stdin is a terminal; a pipe or CI run gets the usage error instead. */
export const cliInputs = (): Inputs => {
  const isTerminal = process.stdin.isTTY === true;

  if (isTerminal) return promptedInputs();

  return silentInputs;
};
