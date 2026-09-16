import { createHash } from 'node:crypto';

const slashBoundaries = (value: string): string => {
  const withoutLeadingSlashes = value.replace(/^\/+/, '');
  const withoutBoundaries = withoutLeadingSlashes.replace(/\/+$/, '');

  return withoutBoundaries;
};

const endpointPath = (endpointUrl: string): [string | undefined, string] => {
  const commaIndex = endpointUrl.indexOf(',');

  if (commaIndex === -1) return [undefined, endpointUrl];

  const prefix = endpointUrl.slice(0, commaIndex + 1);
  const path = endpointUrl.slice(commaIndex + 1).trimStart();

  return [prefix, path];
};

export const endpointIdentity = (endpointUrl: string, subdirectory: string | undefined): string => {
  const trimmedSubdirectory = subdirectory?.trim();

  if (!trimmedSubdirectory) return endpointUrl;

  const normalizedSubdirectory = slashBoundaries(trimmedSubdirectory);

  if (!normalizedSubdirectory) return endpointUrl;

  const [methodPrefix, path] = endpointPath(endpointUrl);
  const normalizedPath = path.replace(/^\/+/, '');
  const prefixedPath = `${normalizedSubdirectory}/${normalizedPath}`;

  if (methodPrefix === undefined) return prefixedPath;

  const identity = `${methodPrefix} ${prefixedPath}`;

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
