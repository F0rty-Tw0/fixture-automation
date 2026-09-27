/** Whether `after` is `before` with characters only inserted, i.e. `before` is a subsequence of `after`. */
export const isInsertionOnly = (before: string, after: string): boolean => {
  let matched = 0;

  for (const character of after) {
    if (before[matched] === character) matched += 1;
  }

  return matched === before.length;
};
