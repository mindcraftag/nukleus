import * as mongoose from "mongoose";

interface ILicense {
  name: string;
  shorttext: string;
  text: string;
  link: string;
  client: mongoose.Types.ObjectId;
  deletedAt: Date;
}

interface LicenseDocument extends ILicense, mongoose.Document {}
interface LicenseModel extends mongoose.Model<LicenseDocument> {
  installIndices(): void;
}

export { ILicense, LicenseDocument, LicenseModel };
