"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const express          = require('express');
const nsvc             = require('@mindcraftgmbh/nukleus-service');
const mongoose         = nsvc.model.mongoose;
const router           = express.Router();
const { XMLParser }    = require("fast-xml-parser");

module.exports = {
    path: "/api/blog",
    router: router,
};

// This function extracts the article preview imageID and introductory text from
// the content of the article.
function loadFieldsFromContent(articles) {
    const parser = new XMLParser({
        ignoreAttributes: false,
        preserveOrder: true,
        attributeNamePrefix: "",
    });

    for (const article of articles) {
        try {
            const xmlElements = parser.parse(article.content);
            // We expect that the first element in the content is a <Header>
            // element with the heroImage attribute. The content of the element
            // should be the introductory text.
            const headerElement = xmlElements[0];

            if (headerElement.Header) {
                article.imageID = headerElement[':@'].heroImage;
                article.text = headerElement.Header[0]["#text"]
            }
        } catch (_) {
            // Errors are expected if the content doesn't contain XML code.
            // There is nothing we can do here.
        }

    }
}

// Verify that all editor IDs are valid userIDs and that all users belong to the client.
async function verifyEditors(userIDs, clientID) {
    const User = mongoose.model("User");
    const users = await User.find({
        _id: {
            $in: userIDs
        },
        deletedAt: {
            $exists: false
        }
    });

    if (users.length !== userIDs.length) {
        return false;
    }

    // Check if any user is not in the client.
    for (const user of users) {
        let foundMembership = false;
        for (const membership of user.memberships) {
            if (membership.client.equals(clientID)) {
                foundMembership = true;
                break;
            }
        }

        if (!foundMembership) {
            return false;
        }
    }

    return true;
}

// ############################################################################################################
// Get list of all accessible blogs for the current client.
// A blog in the client is accessible if:
// - the user is a superadmin
// - the user is the owner or an editor of the blog
// ############################################################################################################
router.route('/')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");

            const blogs = await Blog.find({
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const returnedFields = [ "_id", "name", "commentsEnabled", "public", "owner", "editors" ];

            if (req.user.superadmin) {
                res.json({
                    result: "success",
                    data: nsvc.common.ensureExactFieldsInArray(blogs, returnedFields)
                });
                return;
            }

            const accessibleBlogs = blogs.filter((blog) => blog.owner.equals(req.user._id) || blog.editors.some(id => id.equals(req.user._id)));
            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(accessibleBlogs, returnedFields)
            });
        });
    })

    // ############################################################################################################
    // Create new blog in current client. Only allowed for client admins.
    // ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(['client_admin'], false), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const name = nsvc.verify.string(req, "name");
            const commentsEnabled = nsvc.verify.boolean(req, "commentsEnabled");
            const isPublic = nsvc.verify.boolean(req, "public");
            const editors = nsvc.verify.objectIdArray(req, "editors");

            const Blog = mongoose.model("Blog");

            const existingBlog = await Blog.findOne({
                name: name,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (existingBlog) {
                res.status(400).json({
                    result: "failed",
                    error: "Blog with this name exists."
                });
                return;
            }

            if (!(await verifyEditors(editors, req.user.client))) {
                res.status(400).json({
                    result: "failed",
                    error: "Invalid editor IDs."
                });
                return;
            }

            await Blog.create({
                name: name,
                commentsEnabled: commentsEnabled,
                public: isPublic,
                client: req.user.client,
                owner: req.user._id,
                editors: editors
            });

            res.status(201).json({
                result: "success"
            });
        });
    })

    // ############################################################################################################
    // Modify blog
    // ############################################################################################################
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {

            const id = nsvc.verify.objectId(req, "_id");
            const name = nsvc.verify.string(req, "name");
            const commentsEnabled = nsvc.verify.boolean(req, "commentsEnabled");
            const isPublic = nsvc.verify.boolean(req, "public");
            const editors = nsvc.verify.objectIdArray(req, "editors");

            const Blog = mongoose.model("Blog");

            const blog = await Blog.findOne({
                _id: id,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (!blog) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const isOwner = blog.owner.equals(req.user._id);

            if (!isOwner) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not accessible."
                });
                return;
            }

            const existingBlog = await Blog.findOne({
                _id: {
                    $ne: id
                },
                name: name,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (existingBlog) {
                res.status(400).json({
                    result: "failed",
                    error: "Blog with this name exists."
                });
                return;
            }

            if (!(await verifyEditors(editors, req.user.client))) {
                res.status(400).json({
                    result: "failed",
                    error: "Invalid editor IDs."
                });
                return;
            }

            blog.name = name;
            blog.commentsEnabled = commentsEnabled;
            blog.public = isPublic;
            blog.editors = editors;

            await blog.save();

            res.json({
                result: "success"
            });
        });
    })

    // ############################################################################################################
    // Delete blog
    // ############################################################################################################
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "_id");

            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const blog = await Blog.findOne({
                _id: id,
                client: req.user.client
            });

            if (!blog) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const isOwner = blog.owner.equals(req.user._id);

            if (!isOwner) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not accessible."
                });
                return;
            }

            const deletionTime = new Date();
            blog.deletedAt = deletionTime;
            await blog.save();
            await BlogArticle.updateMany({
                blog: blog._id,
            }, {
                $set: {
                    deletedAt: deletionTime
                }
            });

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get a specific accessible blogs from the current client.
// A blog in the client is accessible if:
// - the user is a superadmin
// - the user is the owner or an editor of the blog
// ############################################################################################################
router.route('/:id')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");

            const blogID = nsvc.verify.toObjectId(req.params.id);

            const blog = await Blog.findOne({
                _id: blogID,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const returnedFields = [ "_id", "name", "commentsEnabled", "public", "owner", "editors" ];

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(blog, returnedFields)
            });
        });
    });

// ############################################################################################################
// Get the public information about a blog.
// ############################################################################################################
router.route('/:id/public')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const blogID = nsvc.verify.toObjectId(req.params.id);

            const blog = await Blog.findOne({
                _id: blogID,
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            if (!blog) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const returnedFields = ["name", "commentsEnabled", "articles"];
            const blogArticles = await BlogArticle.find({
                blog: blog._id,
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            const articles = nsvc.common.ensureExactFieldsInArray(blogArticles, ["_id", "title", "tags", "author", "slug"]);

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject({
                    ...blog,
                    articles
                }, returnedFields)
            });
        });
    });

// ############################################################################################################
// Get the public information about an article.
// ############################################################################################################
router.route('/article/:clientID/:slug')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const slug = nsvc.verify.toString(req.params.slug);
            const clientID = nsvc.verify.toObjectId(req.params.clientID);

            const blogIDs = (await Blog.find({
                client: clientID,
                public: true,
                deletedAt: {
                    $exists: false
                }
            })).map(blog => blog._id);

            const article = await BlogArticle.findOne({
                slug: slug,
                blog: {
                    $in: blogIDs
                },
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            if (!article) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            // If the request has an access token, try to decode it. If the
            // token is valid, add the user to the viewedBy list.
            const token = req.headers['x-access-token'];
            const decoded = nsvc.security.verifyToken(token);
            if (decoded && "id" in decoded) {
                try {
                    const objID = nsvc.verify.toObjectId(decoded.id);
                    await BlogArticle.updateOne({
                        _id: article._id,
                        viewedBy: {
                            $ne: objID
                        }
                    }, {
                        $addToSet: {
                            viewedBy: objID
                        }
                    });
                } catch (_) { }
            }


            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInObject(article, ["_id", "title", "author", "content", "tags", "slug"])
            });
        });
    });

// ############################################################################################################
// Get list of articles in selected blog. Intended for internal use.
// ############################################################################################################
router.route('/:id/article')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const blogID = nsvc.verify.toObjectId(req.params.id);

            const blog = await Blog.findOne({
                _id: blogID,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const articles = await BlogArticle.find({
                blog: blog._id,
                deletedAt: {
                    $exists: false
                }
            });

            res.json({
                result: "success",
                data: nsvc.common.ensureExactFieldsInArray(articles, [
                    "_id", "title", "tags", "public", "author", "slug"
                ])
            });
        });
    })

    // ############################################################################################################
    // Create new article in selected blog.
    // ############################################################################################################
    .post(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const title = nsvc.verify.string(req, "title");
            const slug = nsvc.verify.string(req, "slug");

            const blogID = nsvc.verify.toObjectId(req.params.id);

            const blog = await Blog.findOne({
                _id: blogID,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const existingArticleWithTitle = await BlogArticle.findOne({
                title: title,
                blog: blog._id,
                deletedAt: {
                    $exists: false
                }
            });

            if (existingArticleWithTitle) {
                res.status(400).json({
                    result: "failed",
                    error: "Article with this name exists."
                });
                return;
            }

            // The slug needs to be unique across all articles in the client, so
            // we first need to find all blogs in the client.
            const blogsInClient = await Blog.find({
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const existingArticleWithSlug = await BlogArticle.findOne({
                slug: slug,
                blog: {
                    $in: blogsInClient.map(blog => blog._id)
                },
                deletedAt: {
                    $exists: false
                }
            });

            if (existingArticleWithSlug) {
                res.status(400).json({
                    result: "failed",
                    error: "Article with this slug exists."
                });
                return;
            }

            await BlogArticle.create({
                title: title,
                slug: slug,
                blog: blog._id,
                tags: [],
                content: "",
                public: false,
                author: req.user._id
            });

            res.status(201).json({
                result: "success"
            });
        });
    })
    .put(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            // Because only people we trust (blog editors) can change the content, we can allow a very large content length.
            const MAX_CONTENT_LENGTH = 9999999999;

            const id = nsvc.verify.objectId(req, "_id");
            const title = nsvc.verify.string(req, "title");
            const slug = nsvc.verify.string(req, "slug");
            const content = nsvc.verify.optionalString(req, "content", MAX_CONTENT_LENGTH, "");
            const isPublic = nsvc.verify.boolean(req, "public");
            const tags = nsvc.verify.stringArray(req, "tags");
            const author = nsvc.verify.objectId(req, "author");

            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const article = await BlogArticle.findOne({
                _id: id,
                deletedAt: {
                    $exists: false
                }
            });

            if (!article) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            const blog = await Blog.findOne({
                _id: article.blog,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            // The slug needs to be unique across all articles in the client, so
            // we first need to find all blogs in the client.
            const blogsInClient = await Blog.find({
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            if (title !== article.title) {
                const existingArticle = await BlogArticle.findOne({
                    _id: {
                        $ne: id
                    },
                    title: title,
                    blog: blog._id,
                    deletedAt: {
                        $exists: false
                    }
                });

                if (existingArticle) {
                    res.status(400).json({
                        result: "failed",
                        error: "Article with this name exists."
                    });
                    return;
                }
            }

            if (slug !== article.slug) {
                const existingArticle = await BlogArticle.findOne({
                    _id: {
                        $ne: id
                    },
                    slug: slug,
                    blog: {
                        $in: blogsInClient.map(blog => blog._id)
                    },
                    deletedAt: {
                        $exists: false
                    }
                });

                if (existingArticle) {
                    res.status(400).json({
                        result: "failed",
                        error: "Article with this slug exists."
                    });
                    return;
                }
            }

            // If we are making the article public, we need to set the publishedAt date.
            if (isPublic && !article.public) {
                article.publishedAt = new Date();
            }

            article.slug = slug;
            article.title = title;
            article.content = content;
            article.tags = tags;
            article.public = isPublic;
            article.author = author;
            await article.save();

            res.json({
                result: "success"
            });
        });
    })
    .delete(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const id = nsvc.verify.objectId(req, "_id");

            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const article = await BlogArticle.findOne({
                _id: id,
                deletedAt: {
                    $exists: false
                }
            });

            if (!article) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            const blog = await Blog.findOne({
                _id: article.blog,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            article.deletedAt = new Date();
            await article.save();

            res.json({
                result: "success"
            });
        });
    });

// ############################################################################################################
// Get a specific accessible article from the current client.
// An article is accessible if:
// - the user is the owner or an editor of the blog
// ############################################################################################################
router.route('/:blogId/article/:articleId')
    .get(nsvc.limiting.createLimiter(), nsvc.security.checkAccess(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const blogID = nsvc.verify.toObjectId(req.params.blogId);
            const articleID = nsvc.verify.toObjectId(req.params.articleId);

            const Blog = mongoose.model("Blog");
            const User = mongoose.model("User");
            const BlogArticle = mongoose.model("BlogArticle");

            const article = await BlogArticle.findOne({
                _id: articleID,
                blog: blogID,
                deletedAt: {
                    $exists: false
                }
            }).lean();

            if (!article) {
                res.status(404).json({
                    result: "failed",
                    error: "Article not found."
                });
                return;
            }

            const blog = await Blog.findOne({
                _id: blogID,
                client: req.user.client,
                deletedAt: {
                    $exists: false
                }
            });

            const isOwner = blog?.owner.equals(req.user._id);
            const isEditor = blog?.editors.some(id => id.equals(req.user._id));

            if (!blog || (!isOwner && !isEditor)) {
                res.status(404).json({
                    result: "failed",
                    error: "Blog not found."
                });
                return;
            }

            const authorUser = await User.findOne({
                _id: article.author,
            });

            const numViews = article.viewedBy?.length || 0;
            delete article.viewedBy;

            res.json({
                result: "success",
                data: {
                    ...article,
                    authorName: authorUser.name,
                    views: numViews
                }
            });
        });
    });

router.route('/:blogID/overview')
    .get(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const blogID = nsvc.verify.toObjectId(req.params.blogID);
            const blog = await Blog.findOne({
                _id: blogID,
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            if (!blog) {
                res.json({
                    result: "failed",
                    error: "Blog not found"
                });
                return;
            }

            const recentArticles = await BlogArticle.aggregate([
                {
                    $match: {
                        blog: blogID,
                        public: true,
                        deletedAt: {
                            $exists: false
                        }
                    }
                },
                { $sort: { publishedAt: -1 } },
                { $limit: 8 }
            ]);

            const popularArticles = await BlogArticle.aggregate([
                {
                    $match: {
                        blog: blogID,
                        public: true,
                        deletedAt: {
                            $exists: false
                        }
                    }
                },
                {
                    $addFields: {
                        views: { $size: "$viewedBy" }
                    }
                },
                {
                    $sort: { views: -1 }
                },
                { $limit: 8 }
            ]);

            loadFieldsFromContent(recentArticles);
            loadFieldsFromContent(popularArticles);

            res.json({
                result: "success",
                data: {
                    featured: nsvc.common.ensureExactFieldsInObject(recentArticles[0], [
                        "_id", "title", "tags", "slug", "imageID", "text"
                    ]),
                    mostRecent: nsvc.common.ensureExactFieldsInArray(recentArticles, [
                        "_id", "title", "tags", "slug", "imageID"
                    ]),
                    mostPopular: nsvc.common.ensureExactFieldsInArray(popularArticles, [
                        "_id", "title", "tags", "slug", "imageID"
                    ])
                }
            });
        });
    });

router.route('/:blogID/query')
    .post(nsvc.limiting.createLimiter(), nsvc.security.accessAnonymous(), function (req, res) {
        nsvc.common.handleError(req, res, async function () {
            const Blog = mongoose.model("Blog");
            const BlogArticle = mongoose.model("BlogArticle");

            const blogID = nsvc.verify.toObjectId(req.params.blogID);
            const blog = await Blog.findOne({
                _id: blogID,
                public: true,
                deletedAt: {
                    $exists: false
                }
            });

            if (!blog) {
                res.json({
                    result: "failed",
                    error: "Blog not found"
                });
                return;
            }

            const filterByTag = nsvc.verify.optionalString(req, "tag");
            const searchByTag = nsvc.verify.optionalString(req, "searchTag");
            const filterByText = nsvc.verify.optionalString(req, "text");
            const sortBy = nsvc.verify.optionalString(req, "sortBy");
            const limit = nsvc.verify.optionalIntegerNumberRange(req, "limit", 2, 24, 12);
            const previousArticle = nsvc.verify.optionalString(req, "previousArticle");

            const query = {
                blog: blogID,
                public: true,
                deletedAt: {
                    $exists: false
                }
            };
            
            let sort = {
                publishedAt: -1
            };

            if (filterByTag) {
                query.tags = filterByTag;
            }

            if (filterByText) {
                query["$or"] = [{
                    content: {
                        $regex: filterByText
                    },
                }, {
                    title: {
                        $regex: filterByText
                    }
                }]
            }

            if (previousArticle) {
                try {
                    query.publishedAt = {
                        $lt: new Date(previousArticle)
                    }
                } catch (e) {
                    res.json({
                        result: "failed",
                        error: "field 'previousArticle' must be a date"
                    });
                    return;
                }
            }

            if (sortBy === "views") {
                sort = {
                    views: -1
                }
            }

            const foundArticles = await BlogArticle.aggregate([
                {
                    $match: query
                },
                {
                    $addFields: {
                        views: { $size: "$viewedBy" }
                    }
                },
                { $sort: sort },
                { $limit: limit }
            ]);

            let tags = undefined;
            if (searchByTag) {
                const tagData = await BlogArticle.aggregate([
                    {
                        $match: {
                            blog: blogID,
                            public: true,
                            deletedAt: {
                                $exists: false
                            }
                        }
                    },
                    {
                        $unwind: "$tags"
                    },
                    {
                        $match: {
                            tags: {
                                $regex: searchByTag, $options: 'i'
                            }
                        }
                    },
                    {
                        $group: { _id: '$tags' }
                    },
                    {
                        $sort: { _id: 1 }
                    }
                ]);
                tags = tagData.map(elem => elem._id);
            }

            loadFieldsFromContent(foundArticles);

            res.json({
                result: "success",
                data: {
                    articles: nsvc.common.ensureExactFieldsInArray(foundArticles, [
                        "_id", "title", "tags", "slug", "imageID", "text", "publishedAt"
                    ]),
                    tags: tags
                }
            });
        });
    });
