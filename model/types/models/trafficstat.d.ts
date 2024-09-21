import * as mongoose from "mongoose";

interface ITrafficStat {
  // What are we storing the traffic for. Client always needs to be set and one of item/user/group
  // -----------------------------------------------------------------------------
  item: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  group: mongoose.Types.ObjectId;
  client: mongoose.Types.ObjectId;

  // For when are we storing the traffic. We store per hour
  // -----------------------------------------------------------------------------
  year: number;
  month: number;
  day: number;
  hour: number;

  // How much traffic did we get and also how many requests
  // -----------------------------------------------------------------------------
  bytes: number;
  calls: number;

  createdAt: Date;
  updatedAt: Date;
}

interface TrafficStatDocument extends ITrafficStat, mongoose.Document {}
interface TrafficStatModel extends mongoose.Model<TrafficStatDocument> {
  installIndices(): void;
}

export { ITrafficStat, TrafficStatDocument, TrafficStatModel };
