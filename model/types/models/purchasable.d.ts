import * as mongoose from "mongoose";

interface IPurchasable {
  name: string;
  description: string;
  client: mongoose.Types.ObjectId;
  public: boolean;
  pricesContainVat: boolean;

  options: {
    name: string;
    prices: {
      [currency: string]: number;
    };
    interval: string;
  }[];

  groupId: string;
  activationActions: any[];
  deactivationActions: any[];

  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface PurchasableDocument extends IPurchasable, mongoose.Document {}
interface PurchasableModel extends mongoose.Model<PurchasableDocument> {
  installIndices(): void;
}

export { IPurchasable, PurchasableDocument, PurchasableModel };
