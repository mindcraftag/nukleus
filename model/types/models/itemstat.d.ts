import * as mongoose from "mongoose";

interface IItemStat {
  item: mongoose.Types.ObjectId;
  counts: Map<any, any>;

  createdAt: Date;
  updatedAt: Date;
}

interface ItemStatDocument extends IItemStat, mongoose.Document {}
interface ItemStatModel extends mongoose.Model<ItemStatDocument> {
  installIndices(): void;
}

export { IItemStat, ItemStatDocument, ItemStatModel };
