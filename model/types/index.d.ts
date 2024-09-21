import { ChangeStreamDocument, ChangeStream } from "mongodb";
import { Logger } from "log4js";

export * as mongoose from "mongoose";

export { ReadPreference } from "mongodb-core";
export { ItemVisibility } from "../model/item";
export { DraftMode } from "../model/client";
export { JobState } from "../model/job";
export { ConversationMode } from "../model/client";

export function watchChanges(
  name: string,
  func: (doc: ChangeStreamDocument) => {}
): ChangeStream;
export function installIndices(): void;
export function startPropagatingChanges(): void;
export function stopPropagatingChanges(): void;

export function init(config: any, log: Logger): Promise<void>;

export function shutdown(): void;

export * from "./models/accesstoken";
export * from "./models/apirequest";
export * from "./models/attributetemplate";
export * from "./models/audit";
export * from "./models/blog";
export * from "./models/blogArticle";
export * from "./models/category";
export * from "./models/client";
export * from "./models/clientstat";
export * from "./models/collection";
export * from "./models/conversation";
export * from "./models/conversationentry";
export * from "./models/datatype";
export * from "./models/feature";
export * from "./models/folder";
export * from "./models/group";
export * from "./models/invoice";
export * from "./models/invoicetemplate";
export * from "./models/item";
export * from "./models/itemlike";
export * from "./models/itemstat";
export * from "./models/job";
export * from "./models/jobagent";
export * from "./models/jobtype";
export * from "./models/keyvaluepair";
export * from "./models/license";
export * from "./models/mail";
export * from "./models/mailtemplate";
export * from "./models/newsletter";
export * from "./models/newslettersubscription";
export * from "./models/notification";
export * from "./models/page";
export * from "./models/paymentsetup";
export * from "./models/permission";
export * from "./models/plan";
export * from "./models/plugin";
export * from "./models/purchasable";
export * from "./models/purchase";
export * from "./models/storage";
export * from "./models/trafficstat";
export * from "./models/user";
export * from "./models/workflow";
export * from "./models/workflowinstance";
