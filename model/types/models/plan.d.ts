import * as mongoose from "mongoose";

interface IPlan {
  name: string;
  description: string;
  storages: mongoose.Types.ObjectId[];
  features: string[];

  // Features
  // ---------------------------------------------------------------------------
  jobtypesEnabled: string[];
  datatypesEnabled: string[];
  featuresEnabled: string[];
  workflowsEnabled: mongoose.Types.ObjectId[];
  pluginsEnabled: string[];
  publicDownloadAllowed: boolean;
  brandingAllowed: boolean;
  conversationsAllowed: boolean;
  attributeTemplatesAllowed: boolean;
  paymentEnabled: boolean;
  mailingEnabled: boolean;
  userPurchasesEnabled: boolean;
  userPurchaseProvisionPercent: number;

  // Quotas
  // ---------------------------------------------------------------------------
  storageQuotaGb: number;
  trafficQuotaGb: number;
  maxUserCount: number;

  // Pricing
  // ---------------------------------------------------------------------------
  pricing: {
    monthlyBasePrice: number;
    storagePricePerGb: number;
    trafficPricePerGb: number;
    jobInvocationPrices: Map<any, any>;
  };

  // Misc
  // ---------------------------------------------------------------------------
  visible: boolean;
  defaultPlan: boolean;

  // Drafts
  // ----------------------------------------------------------------------
  draftMode: "FOREVER" | "DELETE_AFTER_GRACE" | "PUBLIC_AFTER_GRACE";
  draftGracePeriodDays: number;

  createdAt: Date;
  updatedAt: Date;
}

interface PlanDocument extends IPlan, mongoose.Document {}
interface PlanModel extends mongoose.Model<PlanDocument> {
  installIndices(): void;
  existsByName(name: string): Promise<boolean>;
}

export { IPlan, PlanDocument, PlanModel };
