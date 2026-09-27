import type { Invoice } from './invoice.type';

export const INVOICE_FIXTURE = {
  id: 'in_123',
  amount_due: 4200,
  status: 'open'
} as const satisfies Invoice;
