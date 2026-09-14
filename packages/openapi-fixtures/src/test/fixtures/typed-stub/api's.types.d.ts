type Invoice = {
  readonly id: string;
  readonly status: 'draft' | 'open';
  readonly memo?: string;
};

type PrototypeValue = {
  readonly flag: boolean;
};

type InvoiceItem = {
  readonly count: number;
  readonly text: string;
  readonly __proto__: PrototypeValue;
};

type Schemas = {
  readonly invoice: Invoice;
  readonly '2.Invoice"Item': InvoiceItem;
};

export type components = {
  readonly schemas: Schemas;
};
