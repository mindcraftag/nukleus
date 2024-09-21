
import * as mongoose from "mongoose";

interface IClient {
  name: string;
  deletedAt: Date;

  // Plans
  // ----------------------------------------------------------------------
  currentPlan: mongoose.Types.ObjectId;
  nextPlan?: mongoose.Types.ObjectId;

  // Storages
  // ----------------------------------------------------------------------
  storages: mongoose.Types.ObjectId[];

  // What can be public
  // ----------------------------------------------------------------------
  publicDownloadAllowed: boolean;
  publicQueryAllowed: boolean;
  publicConversations: boolean;
  publicLikes: boolean;
  publicCategories: boolean;
  publicLicenses: boolean;
  publicUserInfo: boolean;

  // Features enabled
  // ----------------------------------------------------------------------
  workflowsEnabled: mongoose.Types.ObjectId[];
  pluginsEnabled: string[];
  brandingAllowed: boolean;
  branding: {
    logo: string;
  };
  conversationMode: number; // 0=always off, 1=always on, 2=settable per item
  jobtypesEnabled: string[];
  datatypesEnabled: string[];
  featuresEnabled: string[];
  jobtypesEnabledForAll: string[];
  datatypesEnabledForAll: string[];
  featuresEnabledForAll: string[];
  enabledUserAndGroupJobtypes: boolean;
  enabledUserAndGroupDatatypes: boolean;
  enabledUserAndGroupFeatures: boolean;

  // Limits
  // ----------------------------------------------------------------------
  defaultUserStorageQuotaGb: number;
  defaultUserTrafficQuotaGb: number;
  defaultGroupStorageQuotaGb: number;
  defaultGroupTrafficQuotaGb: number;

  // Access control
  // ----------------------------------------------------------------------
  acl: {
    group: mongoose.Types.ObjectId;
    user: mongoose.Types.ObjectId;
    can: string[];
  }[];

  // Invitations
  // ----------------------------------------------------------------------
  invitationToken: string;
  invitationTokenEnabled: boolean;

  // Payment
  // ----------------------------------------------------------------------
  paymentSetup: mongoose.Types.ObjectId;
  paymentLastMonthProcessed: Date;

  // Mailing
  // ----------------------------------------------------------------------
  mailerAddress: string;
  mailerName: string;

  // Drafts
  // ----------------------------------------------------------------------
  draftMode: "FOREVER" | "DELETE_AFTER_GRACE" | "PUBLIC_AFTER_GRACE";
  draftGracePeriodDays: number;

  userPropertiesTemplate: any;

  createdAt: Date;
  updatedAt: Date;
}

interface ClientDocument extends IClient, mongoose.Document {}
interface ClientModel extends mongoose.Model<ClientDocument> {
  existsByName(name: string): Promise<boolean>;
  installIndices(): void;
}

export {IClient, ClientDocument, ClientModel};
