/** The message of an `Error`, or the thrown value rendered as text. */
export const errorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  return String(error);
};
