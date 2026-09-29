/** Which schema a CLI samples and where it writes, once the positionals are resolved against the spec. */
export type SchemaTarget = {
  readonly schemaName: string;
  readonly outFile: string | undefined;
};
