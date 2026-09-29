import { parseJsonOrUndefined } from '../../shared/json/utils/json.util.ts';
import { isRecord } from '../../shared/json/utils/record.util.ts';
import type { SpecDocumentParse } from '../common/spec-loading.type.ts';

const rejected = (message: string): SpecDocumentParse => {
  const parse: SpecDocumentParse = { kind: 'error', message };

  return parse;
};

/** Reads a dropped file's text as an OpenAPI document; YAML is not supported. */
export const parseSpecDocument = (text: string, fileName: string): SpecDocumentParse => {
  const value = parseJsonOrUndefined(text);

  if (value === undefined) return rejected(`${fileName} is not valid JSON.`);

  if (!isRecord(value)) return rejected(`${fileName} must hold a JSON object (an OpenAPI document).`);

  const parse: SpecDocumentParse = { kind: 'document', document: value };

  return parse;
};
