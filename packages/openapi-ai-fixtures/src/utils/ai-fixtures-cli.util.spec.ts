import { describe, expect, it } from 'vitest';

import { parseAiFixtureArgs } from './ai-fixtures-cli.util.ts';

describe('FEATURE: AI fixture CLI arguments', (): void => {
  describe('GIVEN required fixture generation inputs', (): void => {
    const args = ['file:///spec.json', 'invoice', '--fixture', 'base.json', '--scenario', 'Open invoice'];

    it('WHEN no tool is selected THEN rejects rather than choosing a provider', (): void => {
      expect((): unknown => parseAiFixtureArgs(args)).toThrow(Error);
    });

    it('WHEN an unknown tool is selected THEN rejects rather than falling back', (): void => {
      const unknown = [...args, '--tool', 'unknown'];

      expect((): unknown => parseAiFixtureArgs(unknown)).toThrow(Error);
    });

    it.each(['0', '-1', 'NaN', '1.5', '2147483648'])(
      'WHEN the timeout is %s THEN rejects before generation',
      (timeout: string): void => {
        const invalid = [...args, '--tool', 'claude', '--timeout', timeout];

        expect((): unknown => parseAiFixtureArgs(invalid)).toThrow(Error);
      }
    );

    it('WHEN a model is selected THEN carries the slug on the tool options', (): void => {
      const selected = [...args, '--tool', 'claude', '--model', 'opus'];

      expect(parseAiFixtureArgs(selected)?.options.model).toBe('opus');
    });

    it('WHEN no model is selected THEN leaves the tool options without a model', (): void => {
      const unselected = [...args, '--tool', 'claude'];

      expect(parseAiFixtureArgs(unselected)?.options.model).toBeUndefined();
    });

    it('WHEN the model is empty THEN rejects before generation', (): void => {
      const invalid = [...args, '--tool', 'claude', '--model', ''];

      expect((): unknown => parseAiFixtureArgs(invalid)).toThrow(Error);
    });
  });

  describe('GIVEN a spec URL alone in scenario mode', (): void => {
    it('WHEN parsing THEN the schema name and out-file are left for the spec to resolve', (): void => {
      const args = ['file:///spec.json', '--fixture', 'base.json', '--scenario', 'Open invoice', '--tool', 'claude'];
      const expected = { specUrl: 'file:///spec.json', schemaName: undefined, outFile: undefined };

      expect(parseAiFixtureArgs(args)).toMatchObject(expected);
    });

    it('WHEN no positional is given THEN the usage is reported', (): void => {
      const args = ['--fixture', 'base.json', '--scenario', 'Open invoice', '--tool', 'claude'];

      expect((): unknown => parseAiFixtureArgs(args)).toThrow(/usage:/);
    });
  });

  describe('GIVEN missing-field positionals', (): void => {
    const flags = ['--fixture', 'corrupt.json', '--missing', 'missing.json', '--tool', 'claude'];

    it('WHEN only an out-file is given THEN it is the destination and no spec is read', (): void => {
      const expected = { specUrl: undefined, schemaName: undefined, outFile: 'out.json' };

      expect(parseAiFixtureArgs(['out.json', ...flags])).toMatchObject(expected);
    });

    it('WHEN nothing is given THEN output goes to stdout', (): void => {
      expect(parseAiFixtureArgs(flags)?.outFile).toBeUndefined();
    });

    it('WHEN the old spec, schema and out-file form is given THEN the third value is the destination', (): void => {
      const expected = { specUrl: undefined, outFile: 'out.json' };

      expect(parseAiFixtureArgs(['file:///spec.json', 'invoice', 'out.json', ...flags])).toMatchObject(expected);
    });
  });

  describe('GIVEN missing-field inputs', (): void => {
    const args = ['file:///spec.json', 'invoice', '--fixture', 'corrupt.json', '--tool', 'claude'];

    it('WHEN a projection is given without a scenario THEN uses the default missing scenario', (): void => {
      const filling = [...args, '--missing', 'missing.json'];
      const parsed = parseAiFixtureArgs(filling);

      expect(parsed?.missingFile).toBe('missing.json');
      expect(parsed?.scenario).toBe('Fill every missing field with realistic values coherent with the baseline');
    });

    it('WHEN a scenario accompanies the projection THEN keeps the given scenario', (): void => {
      const filling = [...args, '--missing', 'missing.json', '--scenario', '  Fill the status.  '];

      expect(parseAiFixtureArgs(filling)?.scenario).toBe('Fill the status.');
    });

    it('WHEN the scenario is blank THEN rejects rather than silently defaulting', (): void => {
      const blank = [...args, '--missing', 'missing.json', '--scenario', '   '];

      expect((): unknown => parseAiFixtureArgs(blank)).toThrow(Error);
    });

    it('WHEN the projection path is empty THEN rejects before generation', (): void => {
      const empty = [...args, '--missing', ''];

      expect((): unknown => parseAiFixtureArgs(empty)).toThrow(Error);
    });

    it('WHEN no projection is given THEN a scenario is still required', (): void => {
      expect((): unknown => parseAiFixtureArgs(args)).toThrow(/--scenario/);
    });

    it('WHEN no projection is given THEN leaves the options without a missing file', (): void => {
      const enriching = [...args, '--scenario', 'Open invoice'];

      expect(parseAiFixtureArgs(enriching)?.missingFile).toBeUndefined();
    });
  });
});
