import { styleText } from 'node:util';

const styleHeading = (heading: string): string => {
  return styleText(['bold', 'cyan'], heading, { stream: process.stdout });
};

/** Print CLI help with a terminal-aware usage heading, preserving plain text in pipes. */
export const printHelp = (help: string): void => {
  const output = help.replace(/^.+(?:\n.+)*/u, styleHeading);

  process.stdout.write(`${output}\n`);
};
