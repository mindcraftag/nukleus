"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------


export default class NkLinkableItemsCache {

  constructor(apiGateway, itemCache, usePublicApi) {
    this.linkableItemsCache = new Map();
    this.apiGateway = apiGateway;
    this.itemCache = itemCache;
    this.usePublicApi = usePublicApi;
  }

  clear() {
    this.linkableItemsCache.clear();
  }

  resolveItem(id, linkableItems) {
    for (const item of linkableItems) {
      if (item._id === id) {
        return item;
      }
    }

    return null;
  }

  async loadLinkableItems(item, field) {
    if (!item)
      throw "loadLinkableItems(): Item cannot be null!";

    let linkableItems = [];

    if (field.linkableTypes && field.linkableTypes.length) {
      // Do not query in case of public API usage, this is a protected API
      if (!this.usePublicApi) {
        const linkableItemsKey = field.linkableTypes.join("#") + (item.folder ? item.folder._id : "");
        //console.log("Loading linkable items for key:", linkableItemsKey);
        if (this.linkableItemsCache.has(linkableItemsKey)) {
          //console.log("Linkable items are in cache!");
          return this.linkableItemsCache.get(linkableItemsKey);
        }

        //console.log("Linkable items are NOT in cache!");

        // load all linkable objects in that folder
        const validTypes = [...field.linkableTypes];
        if (!validTypes.includes("Package"))
          validTypes.push("Package");

        const queryParams = {
          types: validTypes,
          folder: item.folder ? item.folder._id : null
        };

        linkableItems = (await this.apiGateway.call('LinkableItemsCache::loadLinkableItems', 'queryItemsList', queryParams)).filter(item => {
          if (item.type === "Package") {
            return field.linkableTypes.includes(item.packageType);
          } else {
            return true;
          }
        });

        // the object might have an object linked that lives outside the local folder
        // find those and also get them.
        for (const link of item.links) {
          if (this.resolveItem(link.to, linkableItems) == null) {
            // link item was not found. load it.
            try {
              const item = await this.itemCache.getItem(link.to);
              if (field.linkableTypes.includes(item.type))
                linkableItems.push(item);
            } catch (err) {
              console.error(`Link item ${link.to} not found. Dead link? (${err})`);
            }
          }
        }

        this.linkableItemsCache.set(linkableItemsKey, linkableItems);
      }
    } else {
      // the type has no linkable types so it can link to anything.
      // We need to add the currently linked items (if any) to the list
      for (const link of item.links) {
        const item = await this.itemCache.getItem(link.to);
        linkableItems.push(item);
      }

      const linkableItemsKey = field.usageAs + "#CurrentLinks";
      this.linkableItemsCache.set(linkableItemsKey, linkableItems);
    }

    return linkableItems;
  }

}
