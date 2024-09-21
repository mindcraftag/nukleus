import * as mongoose from "mongoose";

interface IInvoice {
  number: number;
  date: Date; // date on the invoice
  month: number; // invoicing period for client invoices
  year: number; // invoicing period for client invoices

  invoiceTemplate: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  item: mongoose.Types.ObjectId;

  positions: any[];
  subtotalAmount: number;
  vatAmount: number;
  vatPercent: number;
  totalAmount: number;
  currency: string;

  paidAt: Date;
  failedAt: Date;
  message: string;
  refundedAt: Date;
  refundAmount: number;
  refundReason: string;

  paymentInfo: any;

  createdAt: Date;
  updatedAt: Date;
}

interface InvoiceDocument extends IInvoice, mongoose.Document {}
interface InvoiceModel extends mongoose.Model<InvoiceDocument> {
  installIndices(): void;
}

export { IInvoice, InvoiceDocument, InvoiceModel };
