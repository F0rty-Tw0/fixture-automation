import { afterEach, describe, expect, it, vi } from 'vitest';

import { createAiProgressReporter } from './ai-progress.client.ts';

describe('FEATURE: terminal AI progress', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN a partial model response interrupted by a status update', (): void => {
    it('WHEN displaying progress THEN separates status lines without splitting consecutive response chunks', (): void => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((): boolean => true);
      const report = createAiProgressReporter();

      report({ stream: 'stdout', text: '{"memo":"' });
      report({ stream: 'stdout', text: 'working' });
      report({ stream: 'status', text: '[gemini] still running\n' });
      report({ stream: 'stdout', text: '"}' });
      report({ stream: 'status', text: '[gemini] process ended\n' });

      const chunks = stderr.mock.calls.map(([chunk]): string => String(chunk));
      const rendered = chunks.join('');

      expect(rendered).toBe('{"memo":"working\n[gemini] still running\n"}\n[gemini] process ended\n');
    });
  });

  describe('GIVEN provider output containing terminal controls', (): void => {
    it('WHEN displaying progress THEN preserves readable text without allowing terminal commands', (): void => {
      const stderr = vi.spyOn(process.stderr, 'write').mockImplementation((): boolean => true);
      const report = createAiProgressReporter();

      report({ stream: 'stderr', text: '\u001b[31mwarning\u001b[0m\r\n' });
      report({ stream: 'stdout', text: '\u001b' });
      report({ stream: 'stdout', text: '[2Jfixture\u0007\n' });

      const chunks = stderr.mock.calls.map(([chunk]): string => String(chunk));
      const rendered = chunks.join('');

      expect(rendered).toBe('warning\n[2Jfixture\n');
    });
  });
});
