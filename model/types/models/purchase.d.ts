import * as mongoose from "mongoose";

interface IPurchase {
  purchasable: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  location: string;
  client: mongoose.Types.ObjectId;
  option: mongoose.Types.ObjectId;
  active: boolean;
  canceledAt: Date;
  cancellationReason: string;
  remainingNetValue: number;
  cancelGracePeriodUntil: Date;
  paidUntil: Date;
  paymentHistory: {
    date: Date;
    invoice: mongoose.Types.ObjectId;
  }[];

  createdAt: Date;
  updatedAt: Date;
}

interface PurchaseDocument extends IPurchase, mongoose.Document {}
interface PurchaseModel extends mongoose.Model<PurchaseDocument> {
  installIndices(): void;
}

export { IPurchase, PurchaseDocument, PurchaseModel };
