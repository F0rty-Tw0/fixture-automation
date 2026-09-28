import { readFile } from 'node:fs/promises';

import { parseMissingFile } from '@fixture-automation/openapi-ai-fixtures';
import { loadSpec } from '@fixture-automation/openapi-fixtures';
import type { OpenApiSpec } from '@fixture-automation/openapi-fixtures';
import { isRecord } from '@fixture-automation/shared';
import type { FastifyInstance } from 'fastify';

import type { StudioAi } from '../../common/studio-server.type.ts';
import type { DiffBody, DiffResult, LoadedSpec, MissingFile } from '../../contract/common/studio-api.type.ts';
import { buildServer } from '../../server.ts';
import { allowedHosts, allowedOrigins } from '../../utils/allowed-origins.util.ts';

/** The sample spec: named, array-items, inline and non-JSON responses under unsorted paths. */
export const studioSpec = async (): Promise<OpenApiSpec> => {
  const specUrl = new URL('../fixtures/studio/spec.json', import.meta.url);

  return loadSpec(specUrl);
};

/** The Stripe spec trimmed to `GET /v1/invoices/{invoice}` and the 36 schemas `invoice` references directly (~110 kB), as an upload body document. */
export const stripeInvoiceDocument = async (): Promise<Record<string, unknown>> => {
  const fileUrl = new URL('../fixtures/stripe-invoice/spec.json', import.meta.url);
  const text = await readFile(fileUrl, 'utf8');
  const document: unknown = JSON.parse(text);

  if (!isRecord(document)) throw new Error('the Stripe invoice fixture is not a JSON object');

  return document;
};

/** A `missing.json` sample from `test/fixtures/missing/<name>.json`. */
export const missingFixture = async (name: string): Promise<MissingFile> => {
  const fileUrl = new URL(`../fixtures/missing/${name}.json`, import.meta.url);
  const text = await readFile(fileUrl, 'utf8');

  return parseMissingFile(text);
};

/** A ready server with the default origins, the `localhost:80` host `inject` sends, logging off, and the given AI and compute budget. */
export const studioServer = async (ai: StudioAi, computeTimeoutMs = 15_000): Promise<FastifyInstance> => {
  const origins = allowedOrigins(undefined);
  const hosts = allowedHosts(80, origins);
  const fastify = buildServer({ allowedOrigins: origins, allowedHosts: hosts, logger: false, ai, computeTimeoutMs, warmSpecWorker: false });

  await fastify.ready();

  return fastify;
};

/** Uploads `document` to `fastify` and returns its `specId`. */
export const loadDocumentSpec = async (fastify: FastifyInstance, document: unknown): Promise<string> => {
  const payload = { document };
  const response = await fastify.inject({ method: 'POST', url: '/api/specs', payload });
  const loaded = response.json<LoadedSpec>();

  return loaded.specId;
};

/** Uploads the sample spec to `fastify` and returns its `specId`. */
export const loadStudioSpec = async (fastify: FastifyInstance): Promise<string> => {
  const document = await studioSpec();

  return loadDocumentSpec(fastify, document);
};

/** Diffs `body` against the loaded spec `specId` and returns the `missing` file a fill starts from. */
export const diffedMissing = async (fastify: FastifyInstance, specId: string, body: DiffBody): Promise<MissingFile> => {
  const response = await fastify.inject({ method: 'POST', url: `/api/specs/${specId}/diff`, payload: body });
  const diff = response.json<DiffResult>();

  return diff.missing;
};
