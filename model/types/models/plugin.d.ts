import * as mongoose from "mongoose";

interface IPlugin {
    name: string,
    alwaysEnabled: boolean,
    needsSuperadmin: boolean,
    needsPlanFeatures: string[],
    permissionsRequired: string[],
    mounts: any[]
}

interface PluginDocument extends IPlugin, mongoose.Document {}
interface PluginModel extends mongoose.Model<PluginDocument> {
  installIndices(): void;
}

export { IPlugin, PluginDocument, PluginModel };

