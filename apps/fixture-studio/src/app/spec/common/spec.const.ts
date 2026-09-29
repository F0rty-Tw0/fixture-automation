import type { EndpointFilter } from './spec.type.ts';

export const UNTAGGED_GROUP = 'untagged';

export const DEFAULT_ENDPOINT_FILTER: EndpointFilter = {
  query: '',
  tag: '',
  method: ''
};
