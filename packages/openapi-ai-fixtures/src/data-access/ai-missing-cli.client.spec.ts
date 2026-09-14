import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IntegrationProject } from '../test/common/integration.type.ts';
import { missingArgs } from '../test/utils/integration-cli.spec.util.ts';
import { integrationProject } from '../test/utils/integration-project.spec.util.ts';

const SCENARIO = 'missing-mode: fill the absent invoice status.';
const INVALID_SCENARIO = 'missing-mode invalid: return a status outside the enum.';

describe('FEATURE: AI fixture command in missing-field mode', (): void => {
  describe('GIVEN a corrupt invoice, a diff projection, and a controlled external tool', (): void => {
    let project: IntegrationProject;

    beforeEach(async (): Promise<void> => {
      project = await integrationProject();
    });

    afterEach(async (): Promise<void> => {
      await project.dispose();
    });

    it('WHEN writing JSON THEN emits only the absent fields', async (): Promise<void> => {
      const args = missingArgs(project, SCENARIO, false);

      await project.run(args);

      const text = await readFile(project.outputFile, 'utf8');
      const filled: unknown = JSON.parse(text);

      expect(filled).toStrictEqual({ status: 'open' });
    });

    it('WHEN no scenario is given THEN the default missing scenario still fills the fields', async (): Promise<void> => {
      const args = missingArgs(project, SCENARIO, false);
      const scenarioIndex = args.indexOf('--scenario');
      const defaulted = args.toSpliced(scenarioIndex, 2);

      await project.run(defaulted);

      const text = await readFile(project.outputFile, 'utf8');
      const filled: unknown = JSON.parse(text);

      expect(filled).toStrictEqual({ status: 'draft' });
    });

    it('WHEN the old spec and schema positionals are still given THEN they are ignored', async (): Promise<void> => {
      const current = missingArgs(project, SCENARIO, false);
      const args = [project.specUrl, 'invoice', ...current];

      await project.run(args);

      const text = await readFile(project.outputFile, 'utf8');
      const filled: unknown = JSON.parse(text);

      expect(filled).toStrictEqual({ status: 'open' });
    });

    it('WHEN writing a typed stub THEN it declares MISSING_STUB against the missing declarations', async (): Promise<void> => {
      const args = missingArgs(project, SCENARIO, true);

      await project.run(args);

      const source = await readFile(project.outputFile, 'utf8');

      expect(source).toContain('import type { components } from "./missing.d.ts"');
      expect(source).toContain('export const MISSING_STUB: components["schemas"]["missing"] = {');
      expect(source).toContain('"status": "open"');
    });

    it('WHEN the fill breaks the projection THEN preserves the existing destination', async (): Promise<void> => {
      const original = '{"saved":"previous fixture"}\n';
      const args = missingArgs(project, INVALID_SCENARIO, false);

      await writeFile(project.outputFile, original);
      await expect(project.run(args)).rejects.toMatchObject({ code: 1 });

      const after = await readFile(project.outputFile, 'utf8');

      expect(after).toBe(original);
    });

    it('WHEN the projection file is unusable THEN fails before starting the tool', async (): Promise<void> => {
      const broken = join(project.directory, 'broken.json');
      const args = missingArgs(project, SCENARIO, false);
      const missingIndex = args.indexOf('--missing');
      const patched = args.toSpliced(missingIndex + 1, 1, broken);

      await writeFile(broken, '{"schemaName":"invoice"}');
      await expect(project.run(patched)).rejects.toMatchObject({ code: 1 });
    });
  });
});
