import * as mongoose from "mongoose";

interface IApiRequest {
  ip: string;
  path: string;
  method: string;
  status: number;

  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  date: Date;

  location: {
    longitude: number;
    latitude: number;
    country: string;
    region: string;
  };

  client: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;

  requestedItem: mongoose.Types.ObjectId;
  quotaUser: mongoose.Types.ObjectId;
  quotaGroup: mongoose.Types.ObjectId;
  trafficProcessed: boolean;

  bytes: number;
  timeMs: number;
}

interface ApiRequestDocument extends IApiRequest, mongoose.Document {}
interface ApiRequestModel extends mongoose.Model<ApiRequestDocument> {
  installIndices(): void;
}

export {IApiRequest, ApiRequestDocument, ApiRequestModel};
