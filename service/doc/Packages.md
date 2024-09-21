# Packages

## Overview
A package is a collection of all the items and folders required to show a mesh, scene or project. This way assets can easily be shared and reused. Another advantage is that a packaged item is much faster to load on the client, as all the required files are already bundled together and no network requests need to be made.

## Structure
A package is a binary file with the following format:

| MAGIC | HEADER_SIZE | HEADER | METADATA | FOLDERS | FILE_1 | ... | FILE_N |
|-------|-------------|--------|----------|---------|--------|-----|--------|

- `MAGIC`: a magic value to identify the file as a package
- `HEADER_SIZE`: the size of the header in bytes, stored as a 32 bit little-endian unsigned integer
- `HEADER`: the string-representation of a JSON structure containing the following fields:
    - root: id of the root item
    - type: what kind of item is included in this package (Scene, Mesh)
    - metadataSize: size of the metadata block in bytes
    - foldersSize: size of the folder information block in bytes
- `METADATA`: a string-representation of a JSON structure containing the items that are included in this package.
            The key is the item ID[1], the value is the item itself. The item includes a pointer into the files block.
- `FOLDERS`: a string-representation of a JSON structure containing the included folders
- `FILES`: The original content of the files, concatenated together.

The header, metadata and files are compressed with zlib.

## Limitations

- Items can **only link to items, that are inside the *root folder***. The root folder is the folder in which the item that is being packaged is located. The same applies to script imports. This is to ensure that the package is self-contained.
- Any folders that should be included in their entirety (the "sibling folders to include") also **need to be inside the root folder**.
- All items that need to be included need to have an up-to-date filesize. An error is thrown if the `recalculateItemSize` flag is set on any of the items.

### Jobs

#### JS:CreatePackage

When creating a new package, the user that started the job needs to have the `publish` permission on both the item to package and the containing folder (root folder). They also need the `write` permission on the root folder, because that's where the created package is saved. This job can only be started on one item.

#### JS:Unpackage

When unpacking a package into a folder, the user that started the job needs to have the `write` permission on the destination folder and the `read` permission on the package. This job can only be started on one item.

## IDs

Even though item IDs are unique, because multiple versions of the same item can be included in the package, the IDs are not unique inside a package.

**Example:** *Mesh1* links to *Material1* (with a red color) and we create a package of *Mesh1* => *Package1*. Then we edit *Material1* to have a blue color and create a package of *Mesh1* again => *Package2*.

Both Packages will contain two items: *Mesh1* and *Material1*. The IDs of the items will be the same, but the attributes of the items will be different.

One way of differentiating between the two versions of *Material1* is to create a globally unique ID for each item, similar to fully qualified domain names. In our case we create a fully qualified ID (FQID) by prefixing the item ID with the package ID.

## PackageService

The PackageService most importantly exports the function `generatePackageBuffer` to create the binary content of a package for a specified item. This function consists of four stages:

### Stage 1: Discovery

Starting at the root item, find all other items that are neccessary to display the root item. These are all items that are linked to by the root item, and all items that are linked to by these items, and so on. This also includes all script imports. All items inside the "sibling folders to include" are also included.

### Stage 2: Loading

Load the metadata for every item that we discovered. If an item is a package, we add the items from the package to our list of "discovered items". At this stage we also determine the order and position of the file contents, because we know the filesize for every item.

### Stage 3: Folders

Create a list of all folders that are needed to recreate the folder structure of all discovered items. This is needed because scripts can import items / scripts, but only by using the relative path. Therefore the folder structure must be recreated exactly.

### Stage 4: Files

Download the content for every item that has a file.

### Stage 5: Packaging

Combine the different parts into a binary file and compress the header, metadata and files with zlib.
