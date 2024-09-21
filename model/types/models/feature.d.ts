import * as mongoose from "mongoose";

interface IFeature {
  name: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
}

interface FeatureDocument extends IFeature, mongoose.Document {}
interface FeatureModel extends mongoose.Model<FeatureDocument> {
  installIndices(): void;
}

export { IFeature, FeatureDocument, FeatureModel };
