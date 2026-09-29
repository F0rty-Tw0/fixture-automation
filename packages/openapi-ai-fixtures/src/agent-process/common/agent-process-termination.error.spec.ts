import { describe, expect, it } from 'vitest';

import { AgentTerminationError } from './agent-process-termination.error.ts';

describe('FEATURE: agent termination error', (): void => {
  describe('GIVEN a termination failure', (): void => {
    it('WHEN constructed THEN is an Error named after the class', (): void => {
      const error = new AgentTerminationError('Unable to terminate agent process tree 42');

      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('AgentTerminationError');
    });

    it('WHEN constructed with a cause THEN keeps the cause and message', (): void => {
      const cause = new Error('taskkill exited with code 1');

      const error = new AgentTerminationError('Unable to confirm termination of agent process tree 42', { cause });

      expect(error.message).toBe('Unable to confirm termination of agent process tree 42');
      expect(error.cause).toBe(cause);
    });
  });
});
