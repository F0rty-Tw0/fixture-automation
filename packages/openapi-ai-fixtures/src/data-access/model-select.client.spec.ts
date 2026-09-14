import { afterEach, describe, expect, it, vi } from 'vitest';

import { selectModel } from './model-select.client.ts';
import type { ModelDiscovery, ModelSelection } from '../common/model.type.ts';

const discovery: ModelDiscovery = { models: ['alpha', 'beta'], source: 'curated' };

const answering = (...answers: string[]): ((question: string) => Promise<string>) => {
  const queue = [...answers];

  return async (): Promise<string> => {
    const answer = await Promise.resolve(queue.shift());

    return answer ?? '';
  };
};

const interactiveSelection = (prompt: (question: string) => Promise<string>): ModelSelection => {
  const selection: ModelSelection = { tool: 'codex', interactive: true, discovery, prompt };

  return selection;
};

const silence = (): void => undefined;

describe('FEATURE: AI model selection', (): void => {
  afterEach((): void => {
    vi.restoreAllMocks();
  });

  describe('GIVEN an explicit model request', (): void => {
    it('WHEN the model is listed THEN returns it without prompting', async (): Promise<void> => {
      const prompt = vi.fn(answering('1'));
      const selection: ModelSelection = { tool: 'codex', interactive: true, discovery, requested: 'beta', prompt };

      const model = await selectModel(selection);

      expect(model).toBe('beta');
      expect(prompt).not.toHaveBeenCalled();
    });

    it('WHEN the model is unlisted THEN warns on stderr and still returns it', async (): Promise<void> => {
      const warn = vi.spyOn(console, 'error').mockImplementation(silence);
      const selection: ModelSelection = { tool: 'codex', interactive: false, discovery, requested: 'gamma' };

      const model = await selectModel(selection);

      expect(model).toBe('gamma');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('gamma'));
    });

    it('WHEN the model is the harness default THEN returns it without a warning', async (): Promise<void> => {
      const warn = vi.spyOn(console, 'error').mockImplementation(silence);
      const selection: ModelSelection = { tool: 'codex', interactive: false, discovery, requested: 'default' };

      const model = await selectModel(selection);

      expect(model).toBe('default');
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe('GIVEN no model request on an interactive terminal', (): void => {
    it('WHEN a listed number is entered THEN returns the matching model', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);

      const model = await selectModel(interactiveSelection(answering('2')));

      expect(model).toBe('beta');
    });

    it('WHEN zero is entered THEN returns the harness default', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);

      const model = await selectModel(interactiveSelection(answering('0')));

      expect(model).toBe('default');
    });

    it.each(['', 'beta', '9', '-1', '1.5'])(
      'WHEN %s is entered first THEN re-asks and accepts the next answer',
      async (answer: string): Promise<void> => {
        vi.spyOn(console, 'error').mockImplementation(silence);

        const model = await selectModel(interactiveSelection(answering(answer, '1')));

        expect(model).toBe('alpha');
      }
    );

    it('WHEN three answers are invalid THEN rejects instead of guessing a model', async (): Promise<void> => {
      vi.spyOn(console, 'error').mockImplementation(silence);

      const selection = interactiveSelection(answering('x', 'y', 'z'));

      await expect(selectModel(selection)).rejects.toThrow('no model was selected');
    });
  });

  describe('GIVEN no model request outside a terminal', (): void => {
    it('WHEN a model is selected THEN reports the harness default on stderr', async (): Promise<void> => {
      const warn = vi.spyOn(console, 'error').mockImplementation(silence);
      const selection: ModelSelection = { tool: 'claude', interactive: false, discovery };

      const model = await selectModel(selection);

      expect(model).toBe('default');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('harness default'));
    });
  });
});
