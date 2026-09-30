/** An upload document whose `GET /thing` answers `#/components/schemas/thing`, next to the given `schemas`. */
export const thingDocument = (schemas: Record<string, unknown>, openapi = '3.0.3'): Record<string, unknown> => {
  const schema = { $ref: '#/components/schemas/thing' };
  const json = { schema };
  const content = { 'application/json': json };
  const success = { content };
  const responses = { '200': success };
  const get = { responses };
  const route = { get };
  const paths = { '/thing': route };
  const info = { title: 'broken', version: '1' };
  const components = { schemas };
  const document = { openapi, info, paths, components };

  return document;
};
