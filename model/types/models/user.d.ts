import * as mongoose from "mongoose";

interface IUser {
  account: string; // <- email
  password: string;
  name: string;
  displayName?: string;

  // Location
  // --------------------------------------
  location: string,
  nextLocation: string,
  lastLocationSwitchAt: Date,

  // Amount of items and folders that have been moved between locations
  // --------------------------------------
  lastMovedElementsAt: Date,
  movedElementsCount: number,

  // Flags
  // --------------------------------------
  internal: boolean;
  waitingForApproval: boolean;
  active: boolean;
  superadmin: boolean;

  // Invitation
  // --------------------------------------
  invitationToken: string; // For adding a new user by an admin
  clientInvitationToken: string; // For users who join themselves to a client

  // Email confirmation
  // --------------------------------------
  emailToConfirm: string;
  confirmEmailToken: string;
  confirmEmailDate: Date;

  // Forgot password
  // --------------------------------------
  forgotPasswordToken: string;
  forgotPasswordAt: Date;

  // Two factor authentication
  // --------------------------------------
  twoFactorAuth: {
    client: mongoose.Types.ObjectId;
    code: string;
    validUntil: Date;
  }[];

  // Initial attributes with registration
  // --------------------------------------
  initialAttributes: Map<any, any>;

  // Memberships
  // --------------------------------------
  memberships: {
    permissions: string[];
    admin: boolean;
    primary: boolean;
    groups: mongoose.Types.ObjectId[];
    contacts: {
      addedAt: Date;
      user: mongoose.Types.ObjectId;
    }[];
    client: mongoose.Types.ObjectId;
    paymentSetup: mongoose.Types.ObjectId;

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

    // Attributes
    attributes: Map<any, any>;
    properties: any;
  }[];
  removedMemberships: any[];

  // Avatar
  // --------------------------------------
  avatar: { size: number; data: string }[] | undefined;

  deletedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

interface UserDocument extends IUser, mongoose.Document {
  hasMembership(clientId: mongoose.Types.ObjectId): boolean;
  setActiveMembership(requestedClientId: mongoose.Types.ObjectId): boolean;
  hasPermissions(permissions: string[], needsSuperadmin: boolean): boolean;
  isAdmin(): boolean;
  isSystemUser(): boolean;
}

interface UserModel extends mongoose.Model<UserDocument> {
  installIndices(): void;
  existsById(id: mongoose.Types.ObjectId): Promise<boolean>;
  existsByAccount(account: string): Promise<boolean>;
}

export { IUser, UserDocument, UserModel };
