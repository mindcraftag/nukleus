import * as tools from "./common/tools";

export type JobType = ReturnType<typeof tools.verifyJobs>[number];
