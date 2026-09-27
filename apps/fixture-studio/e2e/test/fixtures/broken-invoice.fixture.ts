import { invoiceTotal } from './invoice.builder';

export const INVOICE_FIXTURE = {
  id: 'in_123',
  amount_due: invoiceTotal(),
  status: 'open'
};
