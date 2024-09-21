import { Static, Type } from "@sinclair/typebox";
import { IncomingMessage } from "http";
import { Cron } from "croner";
import * as constants from "./constants";
import { security, ensureDbContent } from "@mindcraftgmbh/nukleus-service";
import { TypeCompiler } from "@sinclair/typebox/compiler";

const WATCHABLE_TYPES = ["Item", "Folder", "Mail", "Client", "User", "Invoice"];

export function getRemoteAddress(req: IncomingMessage) {
  return req.headers["x-forwarded-for"]
    ? `${req.headers["x-forwarded-for"]}:${req.socket.remotePort}`
    : `${req.socket.remoteAddress}:${req.socket.remotePort}`;
}

export const SelectorMethod = {
  findMissingThumbnails: "findMissingThumbnails",
  findMissingPreviews: "findMissingPreviews",
  findMissingLodLevels: "findMissingLodLevels",
  findMissingFolderSize: "findMissingFolderSize",
  findGroupsWithFolder: "findGroupsWithFolder",
  findMissingItemSize: "findMissingItemSize",
  findUsers: "findUsers",
} as const;

const Parameters = Type.Union([
  Type.Object({
    name: Type.String(),
    type: Type.Literal("Number"),
    default: Type.Optional(Type.Number()),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("String"),
    default: Type.Optional(Type.String()),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("Boolean"),
    default: Type.Optional(Type.Boolean()),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("Enum"),
    options: Type.Array(Type.String()),
    default: Type.Optional(Type.String()),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("Folder"),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("Folders"),
  }),
  Type.Object({
    name: Type.String(),
    type: Type.Literal("DatatypeList"),
  }),
]);

const QuerySelector = Type.Object({
  method: Type.Enum(SelectorMethod),
  types: Type.Array(Type.String()),
});
export type QuerySelectorT = Static<typeof QuerySelector>;

const Query = Type.Intersect([
  Type.Object({
    batchSize: Type.Number(),
  }),
  Type.Union([
    Type.Object({
      type: Type.Literal("single"),
      selector: QuerySelector,
    }),
    Type.Object({
      type: Type.Literal("union"),
      selectors: Type.Array(QuerySelector),
    }),
  ]),
]);

export type QueryT = Static<typeof Query>;

const JobSchema = Type.Object({
  name: Type.String(),
  displayName: Type.String(),
  cronExp: Type.Optional(Type.String()),
  interval: Type.Optional(Type.String()),
  elementMode: Type.Optional(Type.String()),
  manualStart: Type.Optional(Type.Boolean()),
  timeout: Type.Optional(Type.Number()),
  contentTypes: Type.Optional(Type.Array(Type.String())),
  types: Type.Optional(Type.Array(Type.String())),
  parameters: Type.Optional(Type.Array(Parameters)),
  watch: Type.Optional(Type.Union(WATCHABLE_TYPES.map((x) => Type.Literal(x)))),
  query: Type.Optional(Query),
});
export type JobTypeAPI = Static<typeof JobSchema>;

export class SchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaError";
  }
}

export function verifyJobs(jobs: unknown[], clientId: string) {
  const jobTypes = [];

  for (const job of jobs) {
    const C = TypeCompiler.Compile(JobSchema);

    if (C.Check(job)) {
      const manualStart = job.manualStart !== undefined ? job.manualStart : true;
      let interval = manualStart ? undefined : job.interval;
      let cronExp = manualStart ? undefined : job.cronExp;

      if (!manualStart && !cronExp && !interval && !job.watch) {
        throw "Non-manual jobs must have either a cron expression, an interval or a watch type.";
      }

      if (!manualStart) {
        if (cronExp) {
          try {
            Cron(cronExp);
          } catch (e) {
            throw "Cron expression is invalid";
          }
          // remove interval if we have a cronExp
          interval = undefined;
        } else {
          for (const intervalObj of constants.INTERVALS) {
            if (intervalObj.name === interval) {
              cronExp = intervalObj.cronExp;
              break;
            }
          }
        }
      }

      const query = job.query;
      const parameters = job.parameters;

      const jobType = {
        name: job.name,
        displayName: job.displayName,
        client: clientId,
        elementMode: job.elementMode || "items",
        contentTypes: job.contentTypes || [],
        types: job.types || [],
        parameters: parameters || [],
        manualStart: manualStart,
        interval: interval,
        cronExp: cronExp,
        watch: job.watch,
        timeout: job.timeout || 0,
        query: query,
      };

      jobTypes.push(jobType);
    } else {
      const err = [...C.Errors(job)];
      throw new SchemaError(JSON.stringify(err));
    }
  }

  return jobTypes;
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createSystemUserToken(systemUserId: string) {
  const jwt = security.createToken(systemUserId, undefined, undefined);
  return jwt;
}

export async function createClientSystemUserToken(clientId: string) {
  const clientSystemUserId = await ensureDbContent.createClientSystemIfNecessary(clientId);
  const jwt = security.createToken(clientSystemUserId, clientId, undefined);
  return jwt;
}
