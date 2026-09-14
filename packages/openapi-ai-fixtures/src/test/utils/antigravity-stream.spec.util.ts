export const antigravityStream = (events: Record<string, unknown>[]): string => {
  const lines = events.map((event): string => JSON.stringify(event));

  return `${lines.join('\n')}\n`;
};
