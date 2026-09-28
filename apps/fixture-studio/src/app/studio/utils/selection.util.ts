import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';

export const toggledSelection = (selected: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(selected);
  const isSelected = next.has(id);

  if (isSelected) {
    next.delete(id);
  } else {
    next.add(id);
  }

  return next;
};

/** Adds every id, or removes every id when `isSelected` is false. */
export const withSelection = (selected: ReadonlySet<string>, ids: string[], isSelected: boolean): Set<string> => {
  const next = new Set(selected);

  for (const id of ids) {
    if (isSelected) {
      next.add(id);
    } else {
      next.delete(id);
    }
  }

  return next;
};

/** Selected endpoint ids in spec order, so generated tabs follow the spec. */
export const selectedEndpointIds = (endpoints: Endpoint[], selected: ReadonlySet<string>): string[] => {
  const isSelected = (endpoint: Endpoint): boolean => selected.has(endpoint.id);

  return endpoints.filter(isSelected).map((endpoint) => endpoint.id);
};
