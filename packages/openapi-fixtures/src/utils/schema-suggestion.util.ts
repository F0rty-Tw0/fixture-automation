const MAX_LISTED = 5;

const isSimilar = (name: string, query: string): boolean => {
  const candidate = name.toLowerCase();

  return candidate.includes(query);
};

const listed = (names: string[]): string => {
  const shown = names.slice(0, MAX_LISTED).join(', ');

  if (names.length <= MAX_LISTED) return `available: ${shown}`;

  return `available: ${shown}, ... (${names.length} total)`;
};

/** `did you mean ...?` when a name looks like the query, otherwise a capped list of what exists. */
export const schemaSuggestion = (names: string[], query: string): string => {
  const needle = query.toLowerCase();
  const similar = names.filter((name: string): boolean => isSimilar(name, needle));

  if (similar.length > 0) return `did you mean ${similar.slice(0, MAX_LISTED).join(', ')}?`;

  if (names.length === 0) return 'the document declares no schemas';

  return listed(names);
};
