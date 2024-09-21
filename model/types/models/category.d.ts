import * as mongoose from "mongoose";

interface ICategory {
  name: string;
  client: mongoose.Types.ObjectId;
  deletedAt: Date;
}

interface CategoryDocument extends ICategory, mongoose.Document {}
interface CategoryModel extends mongoose.Model<CategoryDocument> {
  installIndices(): void;
}

export {ICategory, CategoryDocument, CategoryModel};
