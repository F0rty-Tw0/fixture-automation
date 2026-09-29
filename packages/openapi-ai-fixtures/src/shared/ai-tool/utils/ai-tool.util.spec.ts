import { FixtureError } from '@fixture-automation/openapi-fixtures';
import { describe, expect, it } from 'vitest';

import { TOOL_FIX, parseAiTool } from './ai-tool.util.ts';

describe('FEATURE: AI tool flag parsing', (): void => {
  describe('GIVEN a supported tool name', (): void => {
    it.each(['claude', 'codex', 'antigravity', 'copilot', 'gemini'])(
      'WHEN parsing %s THEN returns it unchanged',
      (tool: string): void => {
        expect(parseAiTool(tool)).toBe(tool);
      }
    );
  });

  describe('GIVEN no tool value', (): void => {
    describe('WHEN parsing', (): void => {
      it('THEN throws a FixtureError naming the missing flag', (): void => {
        expect((): unknown => parseAiTool(undefined)).toThrow(new FixtureError('--tool is required', TOOL_FIX));
      });

      it('THEN the error carries the supported-tools fix', (): void => {
        expect((): unknown => parseAiTool(undefined)).toThrow(expect.objectContaining({ fix: TOOL_FIX }));
      });
    });
  });

  describe('GIVEN an unknown tool value', (): void => {
    describe('WHEN parsing', (): void => {
      it('THEN throws a FixtureError quoting the value', (): void => {
        expect((): unknown => parseAiTool('cursor')).toThrow(/got "cursor"/);
      });

      it('THEN the error carries the supported-tools fix', (): void => {
        expect((): unknown => parseAiTool('cursor')).toThrow(expect.objectContaining({ fix: TOOL_FIX }));
      });
    });
  });

  describe('GIVEN a supported tool in a different casing', (): void => {
    it('WHEN parsing THEN rejects rather than normalizing', (): void => {
      expect((): unknown => parseAiTool('Claude')).toThrow(FixtureError);
    });
  });
});
