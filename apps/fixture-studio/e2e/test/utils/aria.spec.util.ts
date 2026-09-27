/** A snapshot line for a control role that is not followed by a quoted accessible name. */
const UNNAMED_CONTROL =
  /^\s*- '?(?:button|checkbox|combobox|link|menuitem|option|radio|searchbox|slider|spinbutton|switch|tab|textbox)(?! ")(?:[\s:[']|$)/u;

/** Lines of a Playwright aria snapshot that describe an interactive control without an accessible name. */
export const unnamedControls = (snapshot: string): string[] => {
  const lines = snapshot.split('\n');

  return lines.filter((line: string): boolean => UNNAMED_CONTROL.test(line));
};
