import * as mongoose from "mongoose";

interface IItemLike {
  item: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
}

interface ItemLikeDocument extends IItemLike, mongoose.Document {}
interface ItemLikeModel extends mongoose.Model<ItemLikeDocument> {
  installIndices(): void;
}

export { IItemLike, ItemLikeDocument, ItemLikeModel };
