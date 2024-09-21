import * as mongoose from "mongoose";

interface IFolder {
  name: string;
  parent: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;

  location: string;
  nextLocation: string;
  hidden: boolean;
  immutable: boolean;
  contentSize: number;
  recalculateContentSize: boolean;

  acl: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    can: string[];
  }[];

  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface FolderDocument extends IFolder, mongoose.Document {}
interface FolderModel extends mongoose.Model<FolderDocument> {
  existsById(id: mongoose.Types.ObjectId): Promise<boolean>;
  existsByNameFolderAndClient(name: string, parent: mongoose.Types.ObjectId, client: mongoose.Types.ObjectId): Promise<boolean>;
  installIndices(): void;
}

export { IFolder, FolderDocument, FolderModel };
