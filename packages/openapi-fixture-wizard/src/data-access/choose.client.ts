import { FixtureError } from '@fixture-automation/openapi-fixtures';
import type { InputSpec, Question } from '@fixture-automation/openapi-fixtures';

import { parseChoice } from '../utils/choice.util.ts';

const PROMPT_ATTEMPTS = 3;

const printOptions = (input: InputSpec, options: string[]): void => {
  console.error(`${input.label}: ${input.description}`);

  let position = 1;

  for (const option of options) {
    console.error(`  ${position}) ${option}`);
    position += 1;
  }
};

/** Numbered list on stderr, then the option the answer selects; three unusable answers fail the run. */
export const choose = async <TOption extends string>(question: Question, input: InputSpec, options: TOption[]): Promise<TOption> => {
  const range = `a number from 1 to ${options.length}`;

  printOptions(input, options);

  for (let attempt = 0; attempt < PROMPT_ATTEMPTS; attempt += 1) {
    const answer = await question(`${input.label}: `);
    const option = parseChoice(answer, options);

    if (option !== undefined) return option;

    console.error(`enter ${range}`);
  }

  throw new FixtureError(`no ${input.label} chosen after ${PROMPT_ATTEMPTS} attempts`, `answer ${range}`);
};
