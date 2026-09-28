/** The value a promise rejects with; fails the test when it resolves instead. */
export const rejectionOf = async (promise: Promise<unknown>): Promise<unknown> => {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('Expected the promise to reject.');
};
