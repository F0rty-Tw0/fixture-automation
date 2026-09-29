/** Model of the spec URL form. */
export type SpecSource = {
  readonly url: string;
};

type SpecDocumentParsed = {
  readonly kind: 'document';
  readonly document: Record<string, unknown>;
};

type SpecDocumentRejected = {
  readonly kind: 'error';
  readonly message: string;
};

/** Outcome of reading a dropped spec file. */
export type SpecDocumentParse = SpecDocumentParsed | SpecDocumentRejected;
