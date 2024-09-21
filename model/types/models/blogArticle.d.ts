import * as mongoose from "mongoose";

interface IBlogArticle {
  title: string;
  tags: string[];
  content: string;
  slug: string;

  conversation: mongoose.Types.ObjectId;
  author: mongoose.Types.ObjectId;
  blog: mongoose.Types.ObjectId;
  viewedBy: mongoose.Types.ObjectId[];

  public: boolean;
  publishedAt: Date;

  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

interface BlogArticleDocument extends IBlogArticle, mongoose.Document {}
interface BlogArticleModel extends mongoose.Model<BlogArticleDocument> {
  installIndices(): void;
}

export {IBlogArticle, BlogArticleDocument, BlogArticleModel};
