import * as mongoose from "mongoose";

interface INotification {
  text: string;
  client: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  attachedObjects: mongoose.Types.ObjectId[];
  readAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface NotificationDocument extends INotification, mongoose.Document {}
interface NotificationModel extends mongoose.Model<NotificationDocument> {
  installIndices(): void;
}

export { INotification, NotificationDocument, NotificationModel };
