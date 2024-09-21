
import * as mongoose from "mongoose";

interface IClientStat {
  client: mongoose.Types.ObjectId;
  plan: mongoose.Types.ObjectId;
  year: number;
  month: number;
  day: number;
  hour: number;
  metrics: {
    publicDownloadCount: number;
    publicDownloadBytes: number;
    secureDownloadCount: number;
    secureDownloadBytes: number;
    uploadCount: number;
    uploadBytes: number;
    storedCount: number;
    storedBytes: number;
    jobExecutions: Map<any, any>;
  };
}

interface ClientStatDocument extends IClientStat, mongoose.Document {}
interface ClientStatModel extends mongoose.Model<ClientStatDocument> {
  installIndices(): void;
}

export {IClientStat, ClientStatDocument, ClientStatModel};
