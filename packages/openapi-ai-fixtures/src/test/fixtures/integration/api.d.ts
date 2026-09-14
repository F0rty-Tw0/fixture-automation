export type components = {
  schemas: {
    invoice: {
      id: string;
      amount_due: number;
      status: 'draft' | 'open';
      memo?: string;
    };
  };
};
