type TestInvoice = {
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
