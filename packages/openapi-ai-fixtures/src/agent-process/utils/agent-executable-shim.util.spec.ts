import { describe, expect, it } from 'vitest';

import { nodeEntryPathFromWindowsWrapper } from './agent-executable-shim.util.ts';

const NPM_WRAPPER_LINES = [
  '@ECHO off',
  'SET dp0=%~dp0',
  'SET _prog=node',
  'endLocal & goto #_undefined_# 2>NUL || title %COMSPEC% & set PATHEXT=%PATHEXT:;.JS;=;% & "%_prog%"  "%dp0%\\node_modules\\claude\\cli.js" %*'
];
const NPM_WRAPPER = NPM_WRAPPER_LINES.join('\r\n');

describe('FEATURE: Windows wrapper Node entry path', (): void => {
  describe('GIVEN a pnpm wrapper that invokes node directly', (): void => {
    it('WHEN the wrapper quotes the node executable THEN returns the quoted entry path', (): void => {
      const source = '@"%~dp0\\node.exe"  "%~dp0\\..\\codex\\bin\\codex.js" %*\r\n';

      expect(nodeEntryPathFromWindowsWrapper(source)).toBe('%~dp0\\..\\codex\\bin\\codex.js');
    });

    it('WHEN the wrapper names node bare THEN returns the entry path', (): void => {
      const source = 'node "C:\\tools\\gemini\\dist\\index.mjs" %*';

      expect(nodeEntryPathFromWindowsWrapper(source)).toBe('C:\\tools\\gemini\\dist\\index.mjs');
    });

    it('WHEN the entry path lacks a script extension THEN returns undefined', (): void => {
      const source = 'node "C:\\tools\\gemini\\dist\\index" %*';

      expect(nodeEntryPathFromWindowsWrapper(source)).toBeUndefined();
    });
  });

  describe('GIVEN an npm wrapper that routes through a _prog variable', (): void => {
    it('WHEN _prog is node and the endlocal line invokes it THEN returns the entry path', (): void => {
      expect(nodeEntryPathFromWindowsWrapper(NPM_WRAPPER)).toBe('%dp0%\\node_modules\\claude\\cli.js');
    });

    it('WHEN _prog is node but no endlocal invocation follows THEN returns undefined', (): void => {
      const source = 'SET _prog=node\r\n"%_prog%" "%dp0%\\cli.js" %*';

      expect(nodeEntryPathFromWindowsWrapper(source)).toBeUndefined();
    });

    it('WHEN _prog is not node THEN returns undefined', (): void => {
      const source = NPM_WRAPPER.replace('SET _prog=node', 'SET _prog=python');

      expect(nodeEntryPathFromWindowsWrapper(source)).toBeUndefined();
    });
  });

  describe('GIVEN an empty wrapper', (): void => {
    it('WHEN extracting the entry path THEN returns undefined', (): void => {
      expect(nodeEntryPathFromWindowsWrapper('')).toBeUndefined();
    });
  });
});
