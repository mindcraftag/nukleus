import * as mongoose from "mongoose";

interface INewsletterSubscribtion {
  newsletter: mongoose.Types.ObjectId;
  email: string;
  token: string;
  deletedAt?: Date;
  status: "active" | "inactive";

  createdAt: Date;
  updatedAt: Date;
}

interface NewsletterSubscribtionDocument extends INewsletterSubscribtion, mongoose.Document {}
interface NewsletterSubscribtionModel
  extends mongoose.Model<NewsletterSubscribtionDocument> {
  installIndices(): void;
}

export { INewsletterSubscribtion, NewsletterSubscribtionDocument, NewsletterSubscribtionModel };
