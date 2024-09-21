import * as mongoose from "mongoose";

interface IGroup {
  name: string;
  description: string;

  hasFolder: boolean;
  // Location
  location: string,
  lastLocationSwitchAt: Date,

  // Amount of items and folders that have been moved between locations
  lastMovedElementsAt: Date,
  movedElementsCount: number,

  // Storage quota
  storageQuotaGb: number;
  usedStorageQuotaGb: number;

  // Traffic quota
  trafficQuotaGb: number;
  usedTrafficQuotaBytes: number;

  // Allowed stuff
  allowedJobtypes: string[];
  allowedDatatypes: string[];
  allowedFeatures: string[];

  avatar: {
    size: number;
    data: string;
  }[];

  client: mongoose.Types.ObjectId;
  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface GroupDocument extends IGroup, mongoose.Document {}
interface GroupModel extends mongoose.Model<GroupDocument> {
  existsByNameAndClient(name: string, client: mongoose.Types.ObjectId): Promise<boolean>;
  installIndices(): void;
}

export { IGroup, GroupDocument, GroupModel };
