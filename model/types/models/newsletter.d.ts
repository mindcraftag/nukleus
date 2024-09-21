import * as mongoose from "mongoose";

interface INewsletter {
  client: mongoose.Types.ObjectId;
  name: string;
  deletedAt?: Date;
  editors: mongoose.Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
}

interface NewsletterDocument extends INewsletter, mongoose.Document {}
interface NewsletterModel extends mongoose.Model<NewsletterDocument> {
  installIndices(): void;
}

export { INewsletter, NewsletterDocument, NewsletterModel };
