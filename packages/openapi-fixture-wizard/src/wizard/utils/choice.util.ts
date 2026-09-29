/** The option a 1-based answer selects; blank, non-integer and out-of-range answers select nothing. */
export const parseChoice = <TOption extends string>(answer: string, options: TOption[]): TOption | undefined => {
  const trimmed = answer.trim();
  const position = Number(trimmed);
  const isWhole = Number.isInteger(position);

  if (trimmed.length === 0 || !isWhole) return undefined;

  return options[position - 1];
};
