import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MOCK_AI } from '../ai/data-access/ai-mock.client.ts';
import type { ApiErrorBody, DiffBody, DiffResult, MergeBody, MergeResult } from '../contract/common/studio-api.type.ts';
import { loadDocumentSpec, studioServer } from '../test/utils/studio-spec.spec.util.ts';
import { thingDocument } from './test/utils/broken-spec.spec.util.ts';

const ENDPOINT_ID = 'GET /thing';
const DIFF_BODY: DiffBody = { endpointId: ENDPOINT_ID, fixture: {}, requiredOnly: false };
const MERGE_BODY: MergeBody = { endpointId: ENDPOINT_ID, fixture: {}, populated: {} };
const CYCLE_REF = { $ref: '#/components/schemas/cycle' };
const THING_REF = { $ref: '#/components/schemas/thing' };
const GHOST_REF = { $ref: '#/components/schemas/ghost' };
const BAD_CODE = { type: 'string', pattern: '(' };
const GHOST_PROPERTIES = { ghost: GHOST_REF };
const BAD_PROPERTIES = { code: BAD_CODE };
const CYCLE_THING = { allOf: [CYCLE_REF] };
const CYCLE = { allOf: [THING_REF] };
const HAUNTED_THING = { type: 'object', properties: GHOST_PROPERTIES };
const TEXT_SCHEMA = { type: 'string' };
const BAD_THING = { type: 'object', properties: BAD_PROPERTIES };
const CYCLE_SCHEMAS = { thing: CYCLE_THING, cycle: CYCLE };
const SELF_ONE_OF = { oneOf: [THING_REF, TEXT_SCHEMA] };
const SELF_SCHEMAS = { thing: SELF_ONE_OF };
const SELF_FIX = 'break the cycle in the spec: an anyOf/oneOf/allOf member must not refer back to its own schema directly';
const GHOST_SCHEMAS = { thing: HAUNTED_THING };
const BAD_SCHEMAS = { thing: BAD_THING };
const CYCLE_FIX = 'break the $ref/allOf cycle through "#/components/schemas/cycle" in the spec';
const GHOST_FIX = 'add components.schemas["ghost"] to the spec, or point the $ref at an existing schema';
const BAD_FIX = 'fix schema "thing" in the spec so a JSON Schema validator accepts it';
const TAG = { type: 'string' };
const PET_PROPERTIES = { tag: TAG };
const PET = { $anchor: 'pet', type: 'object', required: ['tag'], properties: PET_PROPERTIES };
const TAG_POINTER = { $ref: '#/components/schemas/Pet/properties/tag' };
const PET_ANCHOR = { $ref: '#pet' };
const NAME = { type: 'string' };
const POINTER_PROPERTIES = { name: NAME, tag: TAG_POINTER };
const ANCHOR_PROPERTIES = { name: NAME, pet: PET_ANCHOR };
const POINTER_THING = { type: 'object', required: ['name', 'tag'], properties: POINTER_PROPERTIES };
const ANCHOR_THING = { type: 'object', required: ['name', 'pet'], properties: ANCHOR_PROPERTIES };
const PET_WITHOUT_ANCHOR = { type: 'object', required: ['tag'], properties: PET_PROPERTIES };
const POINTER_SCHEMAS = { thing: POINTER_THING, Pet: PET_WITHOUT_ANCHOR };
const ANCHOR_SCHEMAS = { thing: ANCHOR_THING, Pet: PET };
const POINTER_FIXTURE = { tag: 'cat' };
const ANCHOR_PET = { tag: 'cat' };
const ANCHOR_FIXTURE = { pet: ANCHOR_PET };

describe('FEATURE: fixture routes over broken and unusual specs', (): void => {
  let fastify: FastifyInstance;

  beforeEach(async (): Promise<void> => {
    fastify = await studioServer(MOCK_AI);
  });

  afterEach(async (): Promise<void> => {
    await fastify.close();
  });

  describe.each<[string, Record<string, unknown>, string]>([
    ['an allOf cycle', CYCLE_SCHEMAS, CYCLE_FIX],
    ['a reference to an undeclared component', GHOST_SCHEMAS, GHOST_FIX],
    ['a pattern the validator cannot compile', BAD_SCHEMAS, BAD_FIX],
    ['a oneOf member that refers straight back to its own schema', SELF_SCHEMAS, SELF_FIX]
  ])('GIVEN a spec holding %s', (_label: string, schemas: Record<string, unknown>, fix: string): void => {
    it.each<[string, DiffBody | MergeBody]>([
      ['diff', DIFF_BODY],
      ['merge', MERGE_BODY]
    ])('WHEN posted to %s THEN answers 400 with the fix', async (route: string, body: DiffBody | MergeBody): Promise<void> => {
      const specId = await loadDocumentSpec(fastify, thingDocument(schemas));

      const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/${route}`, payload: body });

      expect(response.statusCode).toBe(400);
      expect(response.json<ApiErrorBody>().fix).toBe(fix);
    });
  });

  describe.each<[string, Record<string, unknown>, string, Record<string, unknown>]>([
    ['a pointer into a component (3.0)', POINTER_SCHEMAS, '3.0.3', POINTER_FIXTURE],
    ['a 3.1 $anchor reference', ANCHOR_SCHEMAS, '3.1.0', ANCHOR_FIXTURE]
  ])(
    'GIVEN a valid spec holding %s',
    (_label: string, schemas: Record<string, unknown>, openapi: string, fixture: Record<string, unknown>): void => {
      it('WHEN diffed THEN answers 200 listing the missing name', async (): Promise<void> => {
        const specId = await loadDocumentSpec(fastify, thingDocument(schemas, openapi));
        const body: DiffBody = { endpointId: ENDPOINT_ID, fixture, requiredOnly: false };

        const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/diff`, payload: body });

        expect(response.statusCode).toBe(200);
        expect(response.json<DiffResult>().missingPaths).toStrictEqual(['name']);
      });

      it('WHEN merged THEN answers 200 and the merged fixture is valid', async (): Promise<void> => {
        const specId = await loadDocumentSpec(fastify, thingDocument(schemas, openapi));
        const populated = { name: 'Rex' };
        const body: MergeBody = { endpointId: ENDPOINT_ID, fixture, populated };

        const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/merge`, payload: body });

        expect(response.statusCode).toBe(200);
        expect(response.json<MergeResult>()).toMatchObject({ valid: true, errors: [] });
      });
    }
  );
});
