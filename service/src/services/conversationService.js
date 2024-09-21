"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const { mongoose, ItemVisibility, ConversationMode } = require('@mindcraftgmbh/nukleus-model');
const mailService       = require('./mailService');
const logger            = require('../tools/logger');
const aclTools          = require('../tools/aclTools');
const config            = require('../config.js');
const ValidationError   = require('../exception.js').ValidationError;

function addSubscriber(subscribers, userId) {
    if (!userId)
        return;

    for (const subscriber of subscribers) {
        if (subscriber.equals(userId))
            return;
    }

    subscribers.push(userId);
}

async function ensureArticleAccess(id, client) {
    const Blog = mongoose.model('Blog');
    const BlogArticle = mongoose.model('BlogArticle');
    const article = await BlogArticle.findOne({
        _id: id,
        deletedAt: { $exists: false }
    });

    if (!article || !article.public) {
        throw new ValidationError("Invalid parent");
    }

    const blog = await Blog.findOne({
        _id: article.blog,
        client: client._id,
        deletedAt: { $exists: false }
    });

    if (!blog || !blog.public) {
        throw new ValidationError("Invalid parent");
    }

    if (!blog.commentsEnabled) {
        throw new ValidationError("Comments not allowed.");
    }

    return article;
}

exports.createConversation = async function(client, plan, user, parentId, parentType) {

    if (!plan.conversationsAllowed || client.conversationMode === ConversationMode.AlwaysOff) {
        throw new ValidationError("Conversations not enabled");
    }

    // Check if parent exists and we may use it
    // ---------------------------------------------------------------------
    let parent;
    let conversationLocation = config.systemLocation;
    let subscribers = [];
    parentType = parentType.toLowerCase();
    switch(parentType) {
        case "item":
            const Item = mongoose.model('Item');
            parent = await Item.findOne({
                _id: parentId,
                client: client._id,
                deletedAt: { $exists: false }
            }).select("allowConversation conversation acl client folder createdBy updatedBy location").exec();

            if (!parent) {
                throw new ValidationError("Invalid parent");
            }

            if (!await aclTools.verifyAndGetAclFor(parent, user, "read")) {
                throw new ValidationError("Access to parent denied");
            }

            if (client.conversationMode === ConversationMode.SettablePerItem && !parent.allowConversation) {
                throw new ValidationError("Conversations not allowed on parent");
            }

            // does the parent maybe already have a conversation? if so just return it
            if (parent.conversation)
                return parent.conversation;

            addSubscriber(subscribers, parent.createdBy);
            addSubscriber(subscribers, parent.updatedBy);
            addSubscriber(subscribers, user._id);

            conversationLocation = parent.location;

            break;
        case "article":
            parent = await ensureArticleAccess(parentId, client);

            if (parent.conversation)
                return parent.conversation;
            break;
        default:
            throw new ValidationError("Invalid parent type");

    }

    // Create new conversation
    // ---------------------------------------------------------------------
    const Conversation = mongoose.model('Conversation');
    const conversation = new Conversation({
        client: client._id,
        location: conversationLocation,
        subscribedUsers: subscribers,
        parent: parentId,
        parentType: parentType
    });
    await conversation.save();

    // Save conversation to parent
    // ---------------------------------------------------------------------
    parent.conversation = conversation._id;
    parent.__user = user._id;
    parent.save({ __user: user._id });

    return conversation;
}

exports.fetchPublicConversation = async function(conversationId) {
    const Conversation = mongoose.model('Conversation');
    const conversation = await Conversation.findOne({
        _id: conversationId,
        deletedAt: { $exists: false }
    }).exec();

    if (!conversation)
        return null;

    const Client = mongoose.model('Client');
    const client = await Client.findOne({ _id: conversation.client, deletedAt: { $exists: false }})
        .select("publicConversations conversationMode currentPlan").exec();

    if (!client.publicConversations || client.conversationMode === ConversationMode.AlwaysOff)
        return null;

    const Plan = mongoose.model('Plan');
    const plan = await Plan.findOne({ _id: client.currentPlan }).select("conversationsAllowed").exec();

    if (!plan.conversationsAllowed) {
        return null;
    }

    // Check if we have access to the parent object before returning anything
    // -----------------------------------------------------------------------
    switch(conversation.parentType) {
        case "item":
            const Item = mongoose.model('Item');
            const item = await Item.findOne({
                _id: conversation.parent,
                client: client._id,
                deletedAt: { $exists: false }
            }).select("allowConversation public").exec();

            if (!item) {
                logger.error("Conversation has invalid parent: " + conversationId);
                return null;
            }

            if (item.visibility < ItemVisibility.NotListed) {
                return null;
            }

            if (client.conversationMode === ConversationMode.SettablePerItem && !item.allowConversation) {
                return null;
            }

            break;
        case "article":
            try {
                await ensureArticleAccess(parentId, client);
            } catch (e) {
                return null;
            }
            break;
        default:
            logger.error("Conversation has invalid parent type: " + conversationId);
            throw "Conversation has unknown or invalid parent.";

    }

    return conversation;
}

exports.fetchConversation = async function(conversationId, client, plan, user, populateUsers) {
    if (!plan.conversationsAllowed || client.conversationMode === ConversationMode.AlwaysOff) {
        return null;
    }

    // Get the conversation
    // -----------------------------------------------------------------------
    const Conversation = mongoose.model('Conversation');
    const query = Conversation.findOne({
        _id: conversationId,
        client: client,
        deletedAt: { $exists: false }
    });

    if (populateUsers) {
        query.populate({
            path: 'subscribedUsers',
            select: 'account name active internal deletedAt'
        });
    }

    const conversation = await query.exec();

    if (!conversation) {
        return null;
    }

    // Check if we have access to the parent object before returning anything
    // -----------------------------------------------------------------------
    switch(conversation.parentType) {
        case "item":
            const Item = mongoose.model('Item');
            const item = await Item.findOne({
                _id: conversation.parent,
                client: client._id,
                deletedAt: { $exists: false }
            }).select("allowConversation acl client folder").exec();

            if (!item) {
                logger.error("Conversation has invalid parent: " + conversationId);
                return null;
            }

            if (client.conversationMode === ConversationMode.SettablePerItem && !item.allowConversation) {
                return null;
            }

            if (!await aclTools.verifyAndGetAclFor(item, user, "read")) {
                return null;
            }

            break;
        case "article":
            try {
                await ensureArticleAccess(conversation.parent, client);
            } catch (e) {
                return null;
            }
            break;
        default:
            logger.error("Conversation has invalid parent type: " + conversationId);
            throw "Conversation has unknown or invalid parent.";

    }

    return conversation;
}

exports.fetchConversationEntries = async function(conversationId, withLocation, userID) {
    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntries = (await ConversationEntry.find({
        conversation: conversationId
    }).select("text createdBy createdAt replyTo deletedAt likedBy " + (withLocation === true ? "location" : "")).populate({ path: "createdBy", select: "name" }).lean()).map(entry => {
        const liked = userID ? (entry.likedBy || []).some(likedBy => likedBy.equals(userID)) : false;
        const numLikes = (entry.likedBy || []).length

        const isDeleted = !!entry.deletedAt;

        delete entry.likedBy;
        delete entry.deletedAt;

        if (!isDeleted) {
            return {
                ...entry,
                liked,
                numLikes
            };
        } else {
            return {
                ...entry,
                text: "",
                createdBy: {
                    _id: "",
                    name: ""
                },
                deleted: true
            }
        }
    });

    return conversationEntries;
}

exports.getConversation = async function(conversationId, client, plan, user) {

    // Get conversation
    // -------------------------------------------------------
    const conversation = await exports.fetchConversation(conversationId, client, plan, user);
    if (!conversation)
        return null;

    // Get entries
    // -------------------------------------------------------
    const conversationEntries = await exports.fetchConversationEntries(conversationId, user.superadmin === true, user._id);

    // Is user subscribed
    // -------------------------------------------------------
    let subscribed = false;
    for (const su of conversation.subscribedUsers) {
        if (su.equals(user._id)) {
            subscribed = true;
        }
    }

    return {
        conversation: {
            parent: conversation.parent,
            parentType: conversation.parentType,
            subscribed: subscribed,
            location: user.superadmin === true ? conversation.location : undefined
        },
        entries: conversationEntries
    }
}

exports.getPublicConversation = async function(conversationId) {

    // Get conversation
    // -------------------------------------------------------
    const conversation = await exports.fetchPublicConversation(conversationId);
    if (!conversation)
        return null;

    // Get entries
    // -------------------------------------------------------
    const conversationEntries = await exports.fetchConversationEntries(conversationId, undefined, undefined);

    return {
        conversation: {
            parent: conversation.parent,
            parentType: conversation.parentType,
        },
        entries: conversationEntries
    }
}

exports.getSubscribedUsers = async function(conversationId, clientId) {
    const Conversation = mongoose.model('Conversation');
    const conversation = await Conversation.findOne({
        _id: conversationId,
        client: clientId,
        deletedAt: { $exists: false }
    }).select("subscribedUsers").exec();
    return conversation.subscribedUsers;
}

exports.subscribeConversation = async function(conversationId, clientId, userId) {
    const Conversation = mongoose.model('Conversation');
    const result = await Conversation.updateOne({
        _id: conversationId,
        client: clientId,
        deletedAt: { $exists: false }
    }, { $addToSet: { subscribedUsers: userId } });

    // Return true if a conversation has been updated, false otherwise.
    return result.matchedCount > 0;
}

exports.unsubscribeConversation = async function(conversationId, clientId, userId) {
    const Conversation = mongoose.model('Conversation');
    const result = await Conversation.updateOne({
        _id: conversationId,
        client: clientId,
        deletedAt: { $exists: false }
    }, { $pull: { subscribedUsers: userId } });

    // Return true if a conversation has been updated, false otherwise.
    return result.matchedCount > 0;
}

exports.existsConversation = async function(conversationId, clientId) {
    const Conversation = mongoose.model('Conversation');
    const conversation = await Conversation.findOne({
        _id: conversationId,
        client: clientId,
        deletedAt: { $exists: false }
    }).select("_id").exec();

    return !!conversation;
}

exports.addConversationEntry = async function(conversationId, clientId, userId, text) {
    if (!await exports.existsConversation(conversationId, clientId)) {
        throw "Conversation not found.";
    }

    const User = mongoose.model('User');
    const user = await User.findOne({
        _id: userId
    }).select("location").exec();

    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntry = new ConversationEntry({
        conversation: conversationId,
        location: user.location,
        text: text,
        createdBy: userId,
        taggedUsers: []
    });
    conversationEntry.save();
    return conversationEntry;
}

exports.isSubscribed = function(conversation, userId) {
    for (const user of conversation.subscribedUsers) {
        if (user.equals(userId)) {
            return true;
        }
    }

    return false;
}

exports.createNewConversationEntryMail = async function(conversation, conversationEntry, sendingUser, clientId) {
    const promises = [];
    for (const user of conversation.subscribedUsers) {
        if (!user.internal && !user._id.equals(sendingUser._id)) {
            promises.push(mailService.createNewConversationEntryMail(user.account, sendingUser.name, conversationEntry.text,
                conversation._id, conversationEntry._id, clientId));
        }
    }
    return Promise.all(promises);
}

exports.postMessage = async function(conversationId, client, plan, user, text, replyTo) {

    const conversation = await exports.fetchConversation(conversationId, client, plan, user, true);
    if (!conversation)
        throw new ValidationError("Conversation not found");

    const ConversationEntry = mongoose.model('ConversationEntry');

    if (replyTo) {
        const parentEntry = await ConversationEntry.findOne({ _id: replyTo, conversation: conversationId, deletedAt: {
            $exists: false
        } }).select("_id").exec();
        if (!parentEntry)
            throw new ValidationError("Post to reply to not found");
    }

    if (!exports.isSubscribed(conversation, user._id)) {
        conversation.subscribedUsers.push(user._id);
        await conversation.save();
    }

    const conversationEntry = new ConversationEntry({
        text: text,
        location: user.location,
        replyTo: replyTo,
        conversation: conversationId,
        createdBy: user
    });

    await conversationEntry.save();
    await exports.createNewConversationEntryMail(conversation, conversationEntry, user, client._id);
    return conversationEntry;
}

exports.editMessage = async function(conversationEntryId, client, plan, user, text) {

    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntry = await ConversationEntry.findOne({ _id: conversationEntryId, createdBy: user._id, deletedAt: {
        $exists: false
    } }).exec();
    if (!conversationEntry)
        return new ValidationError("Post not found");

    const conversation = await exports.fetchConversation(conversationEntry.conversation, client, plan, user);
    if (!conversation)
        return new ValidationError("Conversation not found or no permission");

    conversationEntry.text = text;
    await conversationEntry.save();
}

exports.deleteMessage = async function(conversationEntryId, client, plan, user) {

    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntry = await ConversationEntry.findOne({ _id: conversationEntryId, createdBy: user._id, deletedAt: {
        $exists: false
    } }).exec();
    if (!conversationEntry)
        return new ValidationError("Post not found");

    const conversation = await exports.fetchConversation(conversationEntry.conversation, client, plan, user);
    if (!conversation)
        return new ValidationError("Conversation not found or no permission");

    await ConversationEntry.updateOne({ _id: conversationEntryId }, {$set: { deletedAt: new Date() }});
}

exports.unlikeMessage = async function(conversationEntryId, client, plan, user) {
    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntry = await ConversationEntry.findOne({
        _id: conversationEntryId,
        createdBy: user._id,
        deletedAt: {
            $exists: false
        }
    });

    if (!conversationEntry) {
        return new ValidationError("Post not found");
    }

    const conversation = await exports.fetchConversation(conversationEntry.conversation, client, plan, user);
    if (!conversation)
        return new ValidationError("Conversation not found or no permission");

    await ConversationEntry.updateOne({ _id: conversationEntryId }, { $pull: { likedBy: user._id } });
}

exports.likeMessage = async function(conversationEntryId, client, plan, user) {
    const ConversationEntry = mongoose.model('ConversationEntry');
    const conversationEntry = await ConversationEntry.findOne({
        _id: conversationEntryId,
        createdBy: user._id,
        deletedAt: {
            $exists: false
        }
    });
    if (!conversationEntry) {
        return new ValidationError("Post not found");
    }

    const conversation = await exports.fetchConversation(conversationEntry.conversation, client, plan, user);
    if (!conversation)
        return new ValidationError("Conversation not found or no permission");

    await ConversationEntry.updateOne({ _id: conversationEntryId }, { $addToSet: { likedBy: user._id } });
}
