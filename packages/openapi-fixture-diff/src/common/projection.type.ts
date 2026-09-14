import type { SpecSchema } from './schema.type.ts';

export type ProjectionNode = {
  leaf: SpecSchema | undefined;
  items: ProjectionNode | undefined;
  readonly properties: Map<string, ProjectionNode>;
};
