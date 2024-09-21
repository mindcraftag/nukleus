import nsvc from "@mindcraftgmbh/nukleus-service";
import { QuerySelectorT, QueryT } from "../common/tools";
const mongoose = nsvc.model.mongoose;

// Because selectors can be combined (with "union"), we need to be able to
// filter out only the unique items and discard duplicates. Thats why we need to
// always have an _id field for every item.
type SelectorReturnObject = unknown & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _id: any;
};

type SelectorReturnType = Promise<SelectorReturnObject[]>;

async function findMissingThumbnails(types: string[]): SelectorReturnType {
  const pageSize = 1000;
  let pageIndex = 0;
  let data: Awaited<ReturnType<nsvc.itemService["query"]>>[] = [];

  while (true) {
    const res = await nsvc.itemService.query(
      {
        findMissingThumbnails: true,
        types: types,
        pageSize: pageSize,
        pageIndex: pageIndex,
      },
      undefined
    );

    data = data.concat(res);
    if (res.length < pageSize) break;
    else pageIndex++;
  }

  return data;
}

async function findMissingPreviews(types: string[]): SelectorReturnType {
  const pageSize = 1000;
  let pageIndex = 0;
  let data: Awaited<ReturnType<nsvc.itemService["query"]>>[] = [];

  while (true) {
    const res = await nsvc.itemService.query(
      {
        findMissingPreviews: true,
        types: types,
        pageSize: pageSize,
        pageIndex: pageIndex,
      },
      undefined
    );

    data = data.concat(res);
    if (res.length < pageSize) break;
    else pageIndex++;
  }

  return data;
}

async function findMissingLodLevels(types: string[]): SelectorReturnType {
  const pageSize = 1000;
  let pageIndex = 0;
  let data: Awaited<ReturnType<nsvc.itemService["query"]>>[] = [];

  while (true) {
    const res = await nsvc.itemService.query(
      {
        findMissingLodLevels: true,
        types: types,
        pageSize: pageSize,
        pageIndex: pageIndex,
      },
      undefined
    );

    data = data.concat(res);
    if (res.length < pageSize) break;
    else pageIndex++;
  }

  return data;
}

async function findMissingFolderSize(): SelectorReturnType {
  const Client = mongoose.model("Client");
  const Folder = mongoose.model("Folder") as nsvc.model.FolderModel;

  const clients = await Client.find({
    deletedAt: { $exists: false },
  })
    .select("_id name")
    .exec();

  const foldersWithoutSize = await Folder.find({
    client: {
      $in: clients.map((x) => x._id),
    },
    $or: [{ recalculateContentSize: true }, { contentSize: { $exists: false } }],
    deletedAt: { $exists: false },
  })
    .select("_id parent")
    .exec();

  return foldersWithoutSize;
}

async function findGroupsWithFolder(): SelectorReturnType {
  const Group = mongoose.model("Group");
  const groups = await Group.find({
    hasFolder: true,
    deletedAt: { $exists: false },
  }).exec();

  return groups;
}

async function findUsers(): SelectorReturnType {
  const User = mongoose.model("User");
  return await User.find().exec();
}

async function findMissingItemSize(): SelectorReturnType {
  const Item = mongoose.model("Item");

  // Get all items that have no item size or need to be recalculated
  // -------------------------------------------------------------------
  const aggregate = Item.aggregate();
  aggregate.match({
    $or: [{ itemSize: { $exists: false } }, { recalculateItemSize: true }],
    deletedAt: { $exists: false },
  });
  aggregate.project({
    object_size: {
      $bsonSize: "$$ROOT",
    },
    filesize: 1,
    folder: 1,
  });

  return await aggregate.exec();
}

async function findDataForSelector(selector: QuerySelectorT): SelectorReturnType {
  const TYPED_SELECTORS = ["findMissingThumbnails", "findMissingPreviews", "findMissingLodLevels"];
  const { types, method } = selector;

  if (TYPED_SELECTORS.includes(method) && !types) {
    throw new Error("Missing types for method: " + method);
  }

  if (method === "findMissingThumbnails") {
    return findMissingThumbnails(types);
  } else if (method === "findMissingPreviews") {
    return findMissingPreviews(types);
  } else if (method === "findMissingLodLevels") {
    return findMissingLodLevels(types);
  } else if (method === "findMissingFolderSize") {
    return findMissingFolderSize();
  } else if (method === "findGroupsWithFolder") {
    return findGroupsWithFolder();
  } else if (method === "findMissingItemSize") {
    return findMissingItemSize();
  } else if (method === "findUsers") {
    return findUsers();
  }

  throw new Error("Unknown selector method: " + method);
}

export async function createBatches(query: QueryT) {
  const promises = [];

  if (query.type === "single") {
    promises.push(findDataForSelector(query.selector));
  } else if (query.type === "union") {
    // If the query wants to combine multiple selector, loop over all
    // of them and build a list.
    for (const selector of query.selectors) {
      promises.push(findDataForSelector(selector));
    }
  } else {
    throw new Error("Unknown query: " + JSON.stringify(query));
  }

  // Wait until all find operations have finished.
  const data = await Promise.all(promises);

  // Convert the data (which is an array of arrays, each containing the data for one selector)
  // into a one-dimensional array of all results combined.
  const all = data.reduce((prev, cur) => prev.concat(cur), []);

  // In case an item was matched by multiple selectors, we remove it's duplicates
  // by first finding a list of all unique ObjectIDs...
  const uniqueIDs = [...new Set(all.map((i) => i._id.toString()))];

  // ... and then map every unique ID to one object
  const items = uniqueIDs.map((id) => all.find((obj) => obj._id.toString() === id));

  // Split the long array of data about each task into batches of size "batchSize"
  const batches = [];
  for (let i = 0; i < items.length; i += query.batchSize) {
    const batch = items.slice(i, i + query.batchSize);
    batches.push(batch);
  }

  return batches;
}
