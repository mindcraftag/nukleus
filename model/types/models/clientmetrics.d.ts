
import * as mongoose from "mongoose";

interface IClientMetrics {
  client: mongoose.Types.ObjectId;

  // Metrics
  // ----------------------------------------------------------------------
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
  refMetrics: {
    trafficBytes: number;
    trafficCount: number;
  };
}

interface ClientMetricsDocument extends IClientMetrics, mongoose.Document {}
interface ClientMetricsModel extends mongoose.Model<ClientMetricsDocument> {
  installIndices(): void;
}

export {IClientMetrics, ClientMetricsDocument, ClientMetricsModel};
