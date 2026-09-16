import { createHash } from 'node:crypto';

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
