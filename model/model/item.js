"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const mongoose  = require('mongoose');

exports.ItemVisibility = {
    Draft: 0,
    Private: 1,
    NotListed: 2,
    Public: 3
}

exports.init = function(log) {
    const collectionName = "Item";

    // -----------------------------------------------------------------------
    //  Schema
    // -----------------------------------------------------------------------
    const schema = new mongoose.Schema({

        // Main fields
        // -------------------------------------------------------------
        name: String,
        // Items should be saved in the same location as their parent folder.
        location: { type: String, required: true, default: "CHE" },
        folder: { type: mongoose.Schema.Types.ObjectId, ref: 'Folder' },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
        type: String,
        // If this item is a package, then we also want to know what type of item it contains.
        packageType: String,
        mimeType: String,
        visibility: Number,  //  0 = draft, 1 = private, 2 = not listed, 3 = public
        hash: String,
        version: {
          major: Number,
          minor: Number,
          revision: Number
        },
        hidden: { type: Boolean, default: false },
        shortDescription: String,
        description: String,
        tags: [String],
        flags: [String],
        contributors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }],
        license: { type: mongoose.Schema.Types.ObjectId, ref: 'License' },
        autoDestructAt: Date,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        quotaUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        quotaGroup: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
        publishedAt: Date,
        deletedAt: Date,

        // Storage
        // -------------------------------------------------------------
        encryptionKey: mongoose.Schema.Types.Mixed,
        perceptiveHash: String,
        filename: String,
        filesize: Number,
        storages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Storage' }],
        storageHash: String,
        itemSize: Number,
        totalSize: Number,
        accumulatedSize: Number,
        recalculateItemSize: { type: Boolean, default: false },
        // To prevent multiple uploads from running on the same item, we use this variable to indicate that an upload is in progress.
        // The value should be updated regularly by the upload process to indicate that the upload is still running.
        uploadHeartbeat: Date,

        // Thumbnails
        // -------------------------------------------------------------
        recreateThumbnailsAndPreviews: Boolean,
        thumbnails: {
            type: [{
                size: Number,
                data: String
            }],
            default: undefined
        },

        // Conversation
        // -------------------------------------------------------------
        allowConversation: Boolean,
        conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },
        internalConversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' },

        // Properties, Links and Attributes
        // -------------------------------------------------------------
        properties: {
            type: Map,
            of: String
        },
        attributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        userAttributeTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'AttributeTemplate' },
        userAttributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        internalAttributeTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'AttributeTemplate' },
        internalAttributes: {
            type: Map,
            of: mongoose.Schema.Types.Mixed
        },
        links: [mongoose.Schema.Types.Mixed],

        // Attachments
        // -------------------------------------------------------------
        omitLodGeneration: Boolean,
        attachments: [{
            name: String,
            index: Number,
            filesize: Number,
            mimeType: String,
            hash: String,
            storages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Storage' }],
            storageHash: String
        }],

        // Access control
        // -------------------------------------------------------------
        acl: [{
            group: { type: mongoose.Schema.Types.ObjectId, ref: 'Group' },
            user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            can: [String]
        }]

    }, {
        timestamps: true,
        read: 'primary'
    });

    // -----------------------------------------------------------------------
    //  Indices
    // -----------------------------------------------------------------------
    schema.statics.installIndices = function() {
        schema.index({folder: 1, name: 1, client: 1, deletedAt: 1}, {unique: true});
        schema.index({name: 1}, {collation: {locale: "en", strength: 2}});
        schema.index({tags: 1});
        schema.index({folder: 1});
        schema.index({type: 1});
        schema.index({mimeType: 1});
        schema.index({hidden: 1});
        schema.index({quotaUser: 1});
        schema.index({quotaGroup: 1});
        schema.index({createdBy: 1});
        schema.index({hash: 1});
        schema.index({perceptiveHash: 1});
        schema.index({conversation: 1});
        schema.index({client: 1});
        schema.index({filesize: 1});
        schema.index({deletedAt: 1});
        schema.index({updatedAt: 1});
        schema.index({createdAt: 1});
        schema.index({storageHash: 1});
        schema.index({autoDestructAt: 1});
        schema.index({userAttributeTemplate: 1});
        schema.index({itemSize: 1});
        schema.index({totalSize: 1});
        schema.index({accumulatedSize: 1});
        schema.index({thumbnails: 1});
        schema.index({recalculateItemSize: 1});
        schema.index({recreateThumbnailsAndPreviews: 1});
        schema.index({omitLodGeneration: 1});
        schema.index({"attachments.name": 1});
        schema.index({"attachments.index": 1});

        // Wildcard indexes
        schema.index({"attributes.$**": 1});
        schema.index({"userAttributes.$**": 1});
        schema.index({"properties.$**": 1});
        schema.index({"attachments.$**": 1});

        // Text index
        schema.index({name: "text", description: "text", tags: "text"});
    };

    // -----------------------------------------------------------------------
    //  Statics
    // -----------------------------------------------------------------------
    schema.statics.existsById = async function(id) {
        return await this.model(collectionName).find({ _id: id }).limit(1).count(true) > 0;
    };

    schema.statics.existsByIdAndClient = async function(id, client) {
        return await this.model(collectionName).find({ _id: id, client: client, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
    };

    schema.statics.existsByNameFolderAndClient = async function(name, folder, client) {
        return await this.model(collectionName).find({ name: name, folder: folder, client: client, deletedAt: { $exists: false } }).limit(1).count(true) > 0;
    };

    // -----------------------------------------------------------------------
    //  Methods
    // -----------------------------------------------------------------------
    schema.methods.clone = function() {
        const Item = mongoose.model('Item');
        return new Item({
            name: this.name,
            folder: this.folder,
            type: this.type,
            mimeType: this.mimeType,
            hidden: this.hidden,
            shortDescription: this.shortDescription,
            description: this.description,
            categories: this.categories,
            immutable: this.immutable,
            filename: this.filename,
            filesize: this.filesize,
            attributes: this.attributes,
            attachments: this.attachments,
            tags: this.tags,
            contributors: this.contributors,
            links: this.links,
            hash: this.hash,
            client: this.client
        });
    };

    // -----------------------------------------------------------------------
    //  Plugins
    // -----------------------------------------------------------------------
    //schema.plugin(auditLog);

    // -----------------------------------------------------------------------
    //  Eventhandler
    // -----------------------------------------------------------------------
    mongoose.model(collectionName, schema).on('index', function(err) {
        if (err) {
            log.error(`Indexing error: ${collectionName}: ${err}`);
        } else {
            log.info(`Indexing complete: ${collectionName}`);
        }
    });
}

