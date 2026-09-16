import { copyFile, mkdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { IntegrationProject } from '../test/common/integration.type.ts';
import { integrationArgs } from '../test/utils/integration-cli.spec.util.ts';
import { integrationProject } from '../test/utils/integration-project.spec.util.ts';

describe('FEATURE: AI fixture command', (): void => {
  describe('GIVEN local inputs and a controlled external tool', (): void => {
    let project: IntegrationProject;

    beforeEach(async (): Promise<void> => {
      project = await integrationProject();
    });

    afterEach(async (): Promise<void> => {
      await project.dispose();
    });

    it('WHEN writing JSON THEN emits only the validated fixture', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice for 4200 cents.', false);

      await project.run(args);

      const text = await readFile(project.outputFile, 'utf8');
      const fixture: unknown = JSON.parse(text);

      expect(fixture).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
    });

    it('WHEN streaming progress while writing to stdout THEN stdout remains one schema-valid fixture', async (): Promise<void> => {
      const fileArgs = integrationArgs(project, 'An open invoice for 4200 cents.', false);
      const args = fileArgs.toSpliced(2, 1);

      const result = await project.run(args);
      const fixture: unknown = JSON.parse(result.stdout);

      expect(fixture).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
      expect(result.stderr).toContain('September subscription');
    });

    it('WHEN the first model response is invalid JSON THEN writes the schema-valid correction', async (): Promise<void> => {
      const args = integrationArgs(project, 'recover invalid fixture JSON', false);

      await project.run(args);

      const text = await readFile(project.outputFile, 'utf8');
      const fixture: unknown = JSON.parse(text);

      expect(fixture).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
    });

    it('WHEN malformed output is repaired THEN preserves the original response verbatim', async (): Promise<void> => {
      const args = integrationArgs(project, 'recover invalid fixture JSON', false);

      const result = await project.run(args);
      const saved = `${project.outputFile}.failed-attempt-1.txt`;
      const raw = await readFile(saved, 'utf8');

      expect(raw).toBe('\r\n{"status": \t');
      expect(result.stderr).toContain(saved);
    });

    it('WHEN both attempts fail THEN preserves both raw responses for manual repair', async (): Promise<void> => {
      const args = integrationArgs(project, 'invalid fixture JSON', false);
      const first = `${project.outputFile}.failed-attempt-1.txt`;
      const second = `${project.outputFile}.failed-attempt-2.txt`;
      const failure = project.run(args);

      await expect(failure).rejects.toMatchObject({ code: 1 });
      await expect(failure).rejects.toHaveProperty('stderr', expect.stringContaining(first));
      await expect(failure).rejects.toHaveProperty('stderr', expect.stringContaining(second));

      const original = await readFile(first, 'utf8');
      const correction = await readFile(second, 'utf8');

      expect(original).toBe('\r\n{"status": \t');
      expect(correction).toBe('{"status":"open",}\n');
    });

    it('WHEN writing a typed stub THEN a compiled consumer reads the fixture', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice for 4200 cents.', true);

      await project.run(args);

      const invoice = await project.compile();

      expect(invoice).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
    }, 30000);

    it('WHEN a relative output symlink targets another directory THEN a compiled consumer reads the real destination', async (): Promise<void> => {
      const aliasDirectory = join(project.directory, 'alias');
      const alias = join(aliasDirectory, 'generated.stub.ts');

      await mkdir(aliasDirectory);
      await writeFile(project.outputFile, '');
      await symlink(project.outputFile, alias, 'file');

      const linkedProject: IntegrationProject = { ...project, outputFile: join('alias', 'generated.stub.ts') };
      const args = integrationArgs(linkedProject, 'An open invoice for 4200 cents.', true);

      await project.run(args);

      const invoice = await project.compile();

      expect(invoice).toStrictEqual({ id: 'in_ai', amount_due: 4200, status: 'open', memo: 'September subscription' });
    }, 30000);

    it.each(['invalid enum', 'process failure', 'malformed response', 'invalid fixture JSON'])(
      'WHEN generation has %s THEN preserves the existing destination',
      async (scenario: string): Promise<void> => {
        const original = '{"saved":"previous fixture"}\n';
        const args = integrationArgs(project, scenario, false);

        await writeFile(project.outputFile, original);
        await expect(project.run(args)).rejects.toMatchObject({ code: 1 });

        const after = await readFile(project.outputFile, 'utf8');

        expect(after).toBe(original);
      }
    );

    it('WHEN the destination is the fixture input THEN refuses to overwrite it', async (): Promise<void> => {
      const original = await readFile(project.fixtureFile, 'utf8');
      const protectedProject: IntegrationProject = { ...project, outputFile: project.fixtureFile };
      const args = integrationArgs(protectedProject, 'An open invoice.', false);

      await expect(project.run(args)).rejects.toMatchObject({ code: 1 });

      const after = await readFile(project.fixtureFile, 'utf8');

      expect(after).toBe(original);
    });

    it('WHEN the destination is the declaration input THEN refuses to overwrite it', async (): Promise<void> => {
      const original = await readFile(project.typesFile, 'utf8');
      const protectedProject: IntegrationProject = { ...project, outputFile: project.typesFile };
      const args = integrationArgs(protectedProject, 'An open invoice.', true);

      await expect(project.run(args)).rejects.toMatchObject({ code: 1 });

      const after = await readFile(project.typesFile, 'utf8');

      expect(after).toBe(original);
    });

    it('WHEN an input alias resolves to the destination THEN preserves the original fixture', async (): Promise<void> => {
      const sourceDirectory = join(project.directory, 'source');
      const aliasDirectory = join(project.directory, 'alias');
      const source = join(sourceDirectory, 'base.json');
      const alias = join(aliasDirectory, 'base.json');

      await mkdir(sourceDirectory);
      await copyFile(project.fixtureFile, source);
      await symlink(sourceDirectory, aliasDirectory, 'junction');

      const original = await readFile(source, 'utf8');
      const protectedProject: IntegrationProject = { ...project, fixtureFile: alias, outputFile: source };
      const args = integrationArgs(protectedProject, 'An open invoice.', false);

      await expect(project.run(args)).rejects.toMatchObject({ code: 1 });

      const after = await readFile(source, 'utf8');

      expect(after).toBe(original);
    });

    it('WHEN typed output has no destination THEN refuses an ambiguous types import', async (): Promise<void> => {
      const args = [
        project.specUrl,
        'invoice',
        '--fixture',
        project.fixtureFile,
        '--scenario',
        'An open invoice.',
        '--tool',
        'claude',
        '--ts',
        project.typesFile,
        '--executable',
        project.executable
      ];

      await expect(project.run(args)).rejects.toMatchObject({ code: 1 });
    });

    it('WHEN the fixture file is absent THEN it names the flag and the path', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice.', false);
      const withAbsent = args.map((value: string): string => (value === project.fixtureFile ? 'absent.json' : value));
      const failure = project.run(withAbsent);

      await expect(failure).rejects.toThrow('openapi-ai-fixtures: --fixture file "absent.json" does not exist');
      await expect(failure).rejects.toThrow('see: openapi-ai-fixtures --help');
    });

    it('WHEN the fixture file holds broken JSON THEN it names the file', async (): Promise<void> => {
      const broken = join(project.directory, 'broken.json');

      await writeFile(broken, '{ not json');

      const args = integrationArgs(project, 'An open invoice.', false);
      const withBroken = args.map((value: string): string => (value === project.fixtureFile ? broken : value));

      await expect(project.run(withBroken)).rejects.toThrow('is not valid JSON');
    });

    it('WHEN no tool is named THEN it asks for one', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice.', false);
      const toolIndex = args.indexOf('--tool');
      const before = args.slice(0, toolIndex);
      const after = args.slice(toolIndex + 2);
      const withoutTool = [...before, ...after];
      const failure = project.run(withoutTool);

      await expect(failure).rejects.toThrow('openapi-ai-fixtures: --tool is required');
      await expect(failure).rejects.toThrow('fix: --tool codex, or claude, antigravity, copilot, gemini');
    });

    it('WHEN the spec is a bare path THEN it asks for a URL', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice.', false);
      const withBarePath = args.map((value: string): string => (value === project.specUrl ? 'spec.json' : value));
      const failure = project.run(withBarePath);

      await expect(failure).rejects.toThrow('got bare path "spec.json"');
      await expect(failure).rejects.toThrow('see: openapi-ai-fixtures --help');
    });

    it('WHEN the tool is unknown THEN it lists the supported tools', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice.', false);
      const withUnknown = args.map((value: string): string => (value === 'claude' ? 'nope' : value));

      await expect(project.run(withUnknown)).rejects.toThrow(
        '--tool must be claude, codex, antigravity, copilot, or gemini, got "nope"'
      );
    });

    it('WHEN the schema name is misspelled THEN it suggests the schema that exists', async (): Promise<void> => {
      const args = integrationArgs(project, 'An open invoice.', false);
      const withTypo = args.map((value: string): string => (value === 'invoice' ? 'invoic' : value));
      const failure = project.run(withTypo);

      await expect(failure).rejects.toThrow('schema "invoic" is unavailable');
      await expect(failure).rejects.toThrow('fix: did you mean invoice?');
    });
  });

  describe('GIVEN the help flag', (): void => {
    let project: IntegrationProject;

    beforeEach(async (): Promise<void> => {
      project = await integrationProject();
    });

    afterEach(async (): Promise<void> => {
      await project.dispose();
    });

    it('WHEN running THEN it prints the help on stdout', async (): Promise<void> => {
      const result = await project.run(['--help']);

      expect(result.stdout).toContain('usage: openapi-ai-fixtures <spec-url> [schema-name]');
      expect(result.stdout).toContain('--list-models');
    });
  });
});
