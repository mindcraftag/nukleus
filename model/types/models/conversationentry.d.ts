import * as mongoose from "mongoose";

interface IConversationEntry {
  conversation: mongoose.Types.ObjectId;
  location: string;
  replyTo: mongoose.Types.ObjectId;
  text: string;
  createdBy: mongoose.Types.ObjectId;
  taggedUsers: mongoose.Types.ObjectId[];
  likedBy: mongoose.Types.ObjectId[];

  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface ConversationEntryDocument
  extends IConversationEntry,
    mongoose.Document {}
interface ConversationEntryModel
  extends mongoose.Model<ConversationEntryDocument> {
  installIndices(): void;
}

export {
  IConversationEntry,
  ConversationEntryDocument,
  ConversationEntryModel,
};
