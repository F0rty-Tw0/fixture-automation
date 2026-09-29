import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';

import { UNTAGGED_GROUP } from '../common/spec.const.ts';
import type { EndpointFilter, EndpointGroup } from '../common/spec.type.ts';

const METHOD_ORDER = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'TRACE'];

const tagsOf = (endpoint: Endpoint): string[] => {
  if (endpoint.tags.length === 0) return [UNTAGGED_GROUP];

  return [...endpoint.tags];
};

const primaryTagOf = (endpoint: Endpoint): string => {
  return endpoint.tags[0] ?? UNTAGGED_GROUP;
};

const methodRank = (method: string): number => {
  const rank = METHOD_ORDER.indexOf(method);

  return rank === -1 ? METHOD_ORDER.length : rank;
};

const matchesTag = (endpoint: Endpoint, tag: string): boolean => {
  if (tag === '') return true;

  const tags = tagsOf(endpoint);

  return tags.includes(tag);
};

const matchesQuery = (endpoint: Endpoint, query: string): boolean => {
  if (query === '') return true;

  const summary = endpoint.summary ?? '';
  const text = `${endpoint.path} ${summary}`;
  const haystack = text.toLowerCase();

  return haystack.includes(query);
};

/** Endpoints matching every non-empty filter field; the query matches path or summary, case-insensitive. */
export const filterEndpoints = (endpoints: Endpoint[], filter: EndpointFilter): Endpoint[] => {
  const query = filter.query.trim().toLowerCase();

  const isVisible = (endpoint: Endpoint): boolean => {
    const isMethodMatch = filter.method === '' || endpoint.method === filter.method;

    if (!isMethodMatch) return false;

    const isTagMatch = matchesTag(endpoint, filter.tag);

    if (!isTagMatch) return false;

    return matchesQuery(endpoint, query);
  };

  return endpoints.filter(isVisible);
};

/** Groups by each endpoint's first tag, keeping spec order inside and between groups. */
export const groupByTag = (endpoints: Endpoint[]): EndpointGroup[] => {
  const groups = new Map<string, Endpoint[]>();

  for (const endpoint of endpoints) {
    const tag = primaryTagOf(endpoint);
    const group = groups.get(tag) ?? [];

    group.push(endpoint);
    groups.set(tag, group);
  }

  const toGroup = ([tag, members]: [string, Endpoint[]]): EndpointGroup => {
    const group: EndpointGroup = { tag, endpoints: members };

    return group;
  };

  const entries = [...groups];

  return entries.map(toGroup);
};

export const endpointTags = (endpoints: Endpoint[]): string[] => {
  const tags = new Set(endpoints.flatMap(tagsOf));
  const uniqueTags = [...tags];

  return uniqueTags.sort((left, right) => left.localeCompare(right));
};

export const endpointMethods = (endpoints: Endpoint[]): string[] => {
  const methods = new Set(endpoints.map((endpoint) => endpoint.method));
  const uniqueMethods = [...methods];

  return uniqueMethods.sort((left, right) => methodRank(left) - methodRank(right));
};

export const isSupported = (endpoint: Endpoint): boolean => {
  return endpoint.schemaName !== null;
};
