/** Human label for a file in error messages, e.g. `spec file "api.json"`. */
export const fileLabel = (label: string, file: string): string => {
  return `${label} file "${file}"`;
};
