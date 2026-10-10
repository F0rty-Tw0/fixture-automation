/** The error Node's ESM loader throws when `packageName` is not installed where `openapi-typescript` looks for it. */
export const packageNotFound = (packageName: string): Error => {
  const message = `Cannot find package '${packageName}' imported from /app/node_modules/openapi-typescript/dist/lib/utils.mjs`;
  const error = new Error(message);

  Object.assign(error, { code: 'ERR_MODULE_NOT_FOUND' });

  return error;
};
