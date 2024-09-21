import * as mongoose from "mongoose";

interface IConversation {
  internal: boolean;
  location: string;
  client: mongoose.Types.ObjectId;
  parent: mongoose.Types.ObjectId;
  parentType: string;
  subscribedUsers: mongoose.Types.ObjectId[];
  deletedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationDocument extends IConversation, mongoose.Document {}
interface ConversationModel extends mongoose.Model<ConversationDocument> {
  installIndices(): void;
}

export {IConversation, ConversationDocument, ConversationModel};
