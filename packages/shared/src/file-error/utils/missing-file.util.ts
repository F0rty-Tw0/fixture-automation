/** `true` when Node reported the path as absent (`ENOENT`), for reads and writes alike. */
export const isMissingFile = (error: unknown): boolean => {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
};
