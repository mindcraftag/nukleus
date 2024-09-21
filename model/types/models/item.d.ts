import * as mongoose from "mongoose";

interface IItem {
  name: string;
  folder: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;
  type: string;
  packageType: string;
  location: string;
  mimeType: string;
  visibility: number; //  0 = draft, 1 = private, 2 = not listed, 3 = public
  hash: string;
  version: {
    major: number,
    minor: number,
    revision: number
  },
  hidden: boolean;
  shortDescription: string;
  description: string;
  tags: string[];
  flags: string[];
  contributors: mongoose.Types.ObjectId[];
  categories: mongoose.Types.ObjectId[];
  license: mongoose.Types.ObjectId;
  autoDestructAt: Date;
  createdBy: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  quotaUser: mongoose.Types.ObjectId;
  quotaGroup: mongoose.Types.ObjectId;
  publishedAt: Date;
  deletedAt: Date;

  // Storage
  // -------------------------------------------------------------
  encryptionKey: any;
  perceptiveHash: string;
  filename: string;
  filesize: number;
  storages: mongoose.Types.ObjectId[];
  storageHash: string;
  itemSize: number;
  totalSize: number;
  accumulatedSize: number;
  recalculateItemSize: boolean;
  uploadHeartbeat: Date,

  // Thumbnails
  // -------------------------------------------------------------
  recreateThumbnailsAndPreviews: boolean;
  thumbnails:
    | {
        size: number;
        data: string;
      }[]
    | undefined;

  // Conversation
  // -------------------------------------------------------------
  allowConversation: boolean;
  conversation: mongoose.Types.ObjectId;
  internalConversation: mongoose.Types.ObjectId;

  // Properties, Links and Attributes
  // -------------------------------------------------------------
  properties: Map<any, any>;
  attributes: Map<any, any>;
  userAttributeTemplate: mongoose.Types.ObjectId;
  userAttributes: Map<any, any>;
  internalAttributeTemplate: mongoose.Types.ObjectId;
  internalAttributes: Map<any, any>;
  links: any[];

  // Attachments
  // -------------------------------------------------------------
  omitLodGeneration: boolean;
  attachments: {
    name: string;
    index: number;
    filesize: number;
    mimeType: string;
    hash: string;
    storages: mongoose.Types.ObjectId[];
    storageHash: string;
  }[];

  // Access control
  // -------------------------------------------------------------
  acl: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    can: string[];
  }[];

  createdAt: Date;
  updatedAt: Date;
}

interface ItemDocument extends IItem, mongoose.Document {
  clone(): ItemDocument;
}

interface ItemModel extends mongoose.Model<ItemDocument> {
  installIndices(): void;
  existsById(id: mongoose.Types.ObjectId): Promise<boolean>;
  existsByNameFolderAndClient(name: string, folder: mongoose.Types.ObjectId, client: mongoose.Types.ObjectId): Promise<boolean>;
}

export { IItem, ItemDocument, ItemModel };
