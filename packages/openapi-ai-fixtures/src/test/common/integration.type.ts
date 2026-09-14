export type TestInvoice = {
  readonly id: string;
  readonly amount_due: number;
  readonly status: 'draft' | 'open';
  readonly memo?: string;
};

type TestSchemas = {
  readonly invoice: TestInvoice;
};

export type TestComponents = {
  readonly schemas: TestSchemas;
};

export type CliResult = {
  readonly stdout: string;
  readonly stderr: string;
};

export type IntegrationProject = {
  readonly directory: string;
  readonly specUrl: string;
  readonly fixtureFile: string;
  readonly typesFile: string;
  readonly executable: string;
  readonly outputFile: string;
  readonly run: (args: string[]) => Promise<CliResult>;
  readonly compile: () => Promise<unknown>;
  readonly dispose: () => Promise<void>;
};
