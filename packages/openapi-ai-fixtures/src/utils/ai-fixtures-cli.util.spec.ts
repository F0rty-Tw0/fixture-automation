import { promptedInputs } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it, vi } from 'vitest';

import { answering, silence } from '@fixture-automation/shared/testing';

import { parseAiFixtureArgs } from './ai-fixtures-cli.util.ts';
import { TOOL_FIX } from './ai-tool.util.ts';
import { MISSING_SCENARIO } from '../common/ai-fixtures-cli.const.ts';

describe('FEATURE: AI fixture CLI arguments', (): void => {
  describe('GIVEN required fixture generation inputs', (): void => {
    const args = ['file:///spec.json', 'invoice', '--fixture', 'base.json', '--scenario', 'Open invoice'];

    it('WHEN no tool is selected THEN rejects rather than choosing a provider', async (): Promise<void> => {
      await expect(parseAiFixtureArgs(args)).rejects.toThrow(Error);
    });

    it('WHEN no tool is selected THEN the rejection carries the supported-tools fix', async (): Promise<void> => {
      const failure = parseAiFixtureArgs(args);

      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: TOOL_FIX }));
    });

    it('WHEN no fixture is given THEN the rejection carries its fix', async (): Promise<void> => {
      const noFixture = ['file:///spec.json', 'invoice', '--scenario', 'Open invoice', '--tool', 'claude'];
      const failure = parseAiFixtureArgs(noFixture);

      await expect(failure).rejects.toThrow(expect.objectContaining({ fix: '--fixture invoice.fixture.json' }));
    });

    it('WHEN an unknown tool is selected THEN rejects rather than falling back', async (): Promise<void> => {
      const unknown = [...args, '--tool', 'unknown'];

      await expect(parseAiFixtureArgs(unknown)).rejects.toThrow(Error);
    });

    it.each(['0', '-1', 'NaN', '1.5', '2147483648'])(
      'WHEN the timeout is %s THEN rejects before generation',
      async (timeout: string): Promise<void> => {
        const invalid = [...args, '--tool', 'claude', '--timeout', timeout];

        await expect(parseAiFixtureArgs(invalid)).rejects.toThrow(Error);
      }
    );

    it('WHEN a model is selected THEN carries the slug on the tool options', async (): Promise<void> => {
      const selected = [...args, '--tool', 'claude', '--model', 'opus'];
      const parsed = await parseAiFixtureArgs(selected);

      expect(parsed?.options.model).toBe('opus');
    });

    it('WHEN no model is selected THEN leaves the tool options without a model', async (): Promise<void> => {
      const unselected = [...args, '--tool', 'claude'];
      const parsed = await parseAiFixtureArgs(unselected);

      expect(parsed?.options.model).toBeUndefined();
    });

    it('WHEN the model is empty THEN rejects before generation', async (): Promise<void> => {
      const invalid = [...args, '--tool', 'claude', '--model', ''];

      await expect(parseAiFixtureArgs(invalid)).rejects.toThrow(Error);
    });
  });

  describe('GIVEN a spec URL alone in scenario mode', (): void => {
    it('WHEN parsing THEN the schema name and out-file are left for the spec to resolve', async (): Promise<void> => {
      const args = ['file:///spec.json', '--fixture', 'base.json', '--scenario', 'Open invoice', '--tool', 'claude'];
      const expected = { specUrl: 'file:///spec.json', schemaName: undefined, outFile: undefined };
      const parsed = await parseAiFixtureArgs(args);

      expect(parsed).toMatchObject(expected);
    });

    it('WHEN no positional is given THEN the usage is reported', async (): Promise<void> => {
      const args = ['--fixture', 'base.json', '--scenario', 'Open invoice', '--tool', 'claude'];

      await expect(parseAiFixtureArgs(args)).rejects.toThrow(/usage:/);
    });
  });

  describe('GIVEN missing-field positionals', (): void => {
    const flags = ['--fixture', 'corrupt.json', '--missing', 'missing.json', '--tool', 'claude'];

    it('WHEN only an out-file is given THEN it is the destination and no spec is read', async (): Promise<void> => {
      const expected = { specUrl: undefined, schemaName: undefined, outFile: 'out.json' };
      const parsed = await parseAiFixtureArgs(['out.json', ...flags]);

      expect(parsed).toMatchObject(expected);
    });

    it('WHEN nothing is given THEN output goes to stdout', async (): Promise<void> => {
      const parsed = await parseAiFixtureArgs(flags);

      expect(parsed?.outFile).toBeUndefined();
    });

    it('WHEN the old spec, schema and out-file form is given THEN the third value is the destination', async (): Promise<void> => {
      const expected = { specUrl: undefined, outFile: 'out.json' };
      const parsed = await parseAiFixtureArgs(['file:///spec.json', 'invoice', 'out.json', ...flags]);

      expect(parsed).toMatchObject(expected);
    });
  });

  describe('GIVEN missing-field inputs', (): void => {
    const args = ['file:///spec.json', 'invoice', '--fixture', 'corrupt.json', '--tool', 'claude'];

    it('WHEN a projection is given without a scenario THEN uses the default missing scenario', async (): Promise<void> => {
      const filling = [...args, '--missing', 'missing.json'];
      const parsed = await parseAiFixtureArgs(filling);

      expect(parsed?.missingFile).toBe('missing.json');
      expect(parsed?.scenario).toBe('Fill every missing field with realistic values coherent with the baseline');
    });

    it('WHEN a scenario accompanies the projection THEN keeps the given scenario', async (): Promise<void> => {
      const filling = [...args, '--missing', 'missing.json', '--scenario', '  Fill the status.  '];
      const parsed = await parseAiFixtureArgs(filling);

      expect(parsed?.scenario).toBe('Fill the status.');
    });

    it('WHEN the scenario is blank THEN rejects rather than silently defaulting', async (): Promise<void> => {
      const blank = [...args, '--missing', 'missing.json', '--scenario', '   '];

      await expect(parseAiFixtureArgs(blank)).rejects.toThrow(Error);
    });

    it('WHEN the projection path is empty THEN rejects before generation', async (): Promise<void> => {
      const empty = [...args, '--missing', ''];

      await expect(parseAiFixtureArgs(empty)).rejects.toThrow(Error);
    });

    it('WHEN no projection is given THEN a scenario is still required', async (): Promise<void> => {
      await expect(parseAiFixtureArgs(args)).rejects.toThrow(/--scenario/);
    });

    it('WHEN no projection is given THEN leaves the options without a missing file', async (): Promise<void> => {
      const enriching = [...args, '--scenario', 'Open invoice'];
      const parsed = await parseAiFixtureArgs(enriching);

      expect(parsed?.missingFile).toBeUndefined();
    });
  });

  describe('GIVEN a terminal missing every required input', (): void => {
    it('WHEN every prompt is answered THEN parses the answers, asks the unset optionals and leaves schema-name to the caller', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(
        answering('file:///spec.json', 'base.json', 'Open invoice', 'codex', 'x.json', '', '', '1000', 'invoice')
      );

      const parsed = await parseAiFixtureArgs([], promptedInputs(question));
      const expectedOptions = { tool: 'codex', timeoutMs: 1000 };
      const expected = {
        specUrl: 'file:///spec.json',
        fixtureFile: 'base.json',
        scenario: 'Open invoice',
        outFile: 'x.json',
        typesFile: undefined,
        schemaName: undefined,
        options: expectedOptions
      };

      expect(parsed).toMatchObject(expected);
      expect(question).toHaveBeenCalledTimes(8);
    });
  });

  describe('GIVEN a terminal with every argument flagged', (): void => {
    it('WHEN parsing THEN never asks', async (): Promise<void> => {
      const args = ['file:///spec.json', 'invoice', '--fixture', 'base.json', '--scenario', 'Open invoice', '--tool', 'claude'];
      const question = vi.fn(answering('unused'));

      await parseAiFixtureArgs(args, promptedInputs(question));

      expect(question).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN a terminal in missing mode short only --tool', (): void => {
    it('WHEN answering THEN only --tool and the optionals are asked, and the spec is never asked', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const question = vi.fn(answering('claude', 'out.json', '', '', ''));

      const parsed = await parseAiFixtureArgs(['--missing', 'm.json', '--fixture', 'f.json'], promptedInputs(question));
      const expected = { specUrl: undefined, scenario: MISSING_SCENARIO, outFile: 'out.json' };

      expect(parsed).toMatchObject(expected);
      expect(question).toHaveBeenCalledTimes(5);
    });
  });

  describe('GIVEN a terminal answers an unsupported tool', (): void => {
    it('WHEN --tool is missing and the typed answer is invalid THEN rejects without retrying', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);
      const args = ['file:///spec.json', 'invoice', '--fixture', 'base.json', '--scenario', 'Open invoice'];
      const question = vi.fn(answering('nope'));

      await expect(parseAiFixtureArgs(args, promptedInputs(question))).rejects.toThrow('--tool must be');
    });
  });
});
