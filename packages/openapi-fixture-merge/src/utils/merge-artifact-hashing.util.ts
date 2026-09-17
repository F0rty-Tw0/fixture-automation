import { createHash } from 'node:crypto';

const HTTP_METHOD_TOKEN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/u;

const slashBoundaries = (value: string): string => {
  const trimmed = value.trim();
  const withoutLeadingSlashes = trimmed.replace(/^\/+/, '');
  const withoutBoundaries = withoutLeadingSlashes.replace(/\/+$/, '');

  return withoutBoundaries;
};

const endpointPath = (endpointUrl: string): [string | undefined, string] => {
  const commaIndex = endpointUrl.indexOf(',');

  if (commaIndex === -1) return [undefined, endpointUrl];

  const method = endpointUrl.slice(0, commaIndex).trim();
  const isMethod = HTTP_METHOD_TOKEN.test(method);

  if (!isMethod) return [undefined, endpointUrl];

  const prefix = method.toUpperCase();
  const path = endpointUrl.slice(commaIndex + 1).trimStart().replace(/^\/+/, '');

  return [prefix, path];
};

const prefixedEndpointPath = (path: string, subdirectory: string | undefined): string => {
  const normalizedSubdirectory = slashBoundaries(subdirectory ?? '');

  if (!normalizedSubdirectory) return path;

  const normalizedPath = path.replace(/^\/+/, '');
  const prefixedPath = `${normalizedSubdirectory}/${normalizedPath}`;

  return prefixedPath;
};

export const endpointIdentity = (endpointUrl: string, subdirectory: string | undefined): string => {
  const [methodPrefix, path] = endpointPath(endpointUrl);
  const prefixedPath = prefixedEndpointPath(path, subdirectory);

  if (methodPrefix === undefined) return prefixedPath;

  const identity = `${methodPrefix},${prefixedPath}`;

  return identity;
};

export const endpointArtifactFileName = (endpointUrl: string): string => {
  const endpointHash = createHash('sha1').update(endpointUrl, 'utf8').digest('base64');
  const safeEndpointHash = endpointHash.replaceAll('/', 'x');
  const fileName = `${safeEndpointHash}.json`;

  return fileName;
};

export const sha256Content = (content: string): string => {
  const checksum = createHash('sha256').update(content, 'utf8').digest('hex');

  return checksum;
};
