import type { Endpoint } from '@fixture-automation/fixture-studio-api/contract';

/** Filter over the loaded endpoints; an empty string means "any". */
export type EndpointFilter = {
  readonly query: string;
  readonly tag: string;
  readonly method: string;
};

export type EndpointGroup = {
  readonly tag: string;
  readonly endpoints: Endpoint[];
};
