import * as mongoose from "mongoose";

interface IPage {
  title: string;
  slug: string;
  content: string;
  client: mongoose.Types.ObjectId;
  public: boolean;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

interface PageDocument extends IPage, mongoose.Document {}
interface PageModel extends mongoose.Model<PageDocument> {
  installIndices(): void;
}

export {IPage, PageDocument, PageModel};
