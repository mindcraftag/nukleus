import * as mongoose from "mongoose";

interface IPaymentSetup {
  vatNo: string;
  vatAmount: number;
  currency: string;
  customerId: string;
  paymentMethodId: string;
  cardInfo: any;

  address: {
    name: string;
    email: string;
    emailToConfirm: string;
    confirmEmailToken: string;
    confirmEmailDate: Date;
    street: string;
    zipcode: string;
    city: string;
    country: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

interface PaymentSetupDocument extends IPaymentSetup, mongoose.Document {}
interface PaymentSetupModel extends mongoose.Model<PaymentSetupDocument> {}

export { IPaymentSetup, PaymentSetupDocument, PaymentSetupModel };
