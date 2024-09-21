// Composables
import { createRouter, createWebHistory } from "vue-router";
import store from "../store";

const routes = [
  {
    path: "/",
    redirect: {
      name: "ItemsRoot",
    },
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/conversation/:conversationId/:conversationEntryId",
    name: "Conversation",
    component: () => import("../views/Conversation.vue"),
  },
  {
    path: "/items",
    name: "ItemsRoot",
    component: () => import("../views/Items.vue"),
    meta: {
      breadcrumb: [{ name: "Root", href: "ItemsRoot" }],
    },
  },
  {
    path: "/items/:folderId?",
    name: "Items",
    component: () => import("../views/Items.vue"),
    meta: {
      breadcrumb: [],
    },
  },
  {
    path: "/edititem/:id",
    name: "EditItem",
    component: () => import("../views/EditItem.vue"),
    meta: {
      breadcrumb: [
        { name: "Items", href: "Items", params: { folderId: 0 } },
        { name: "Edit Item" },
      ],
    },
  },
  {
    path: "/showitem/:id",
    name: "ShowItem",
    component: () => import("../views/ShowItem.vue"),
  },
  {
    path: "/module/:module/:mount/:id?",
    name: "ModuleView",
    component: () => import("../views/ModuleView.vue"),
    meta: {},
  },
  {
    path: "/query",
    name: "Query",
    component: () => import("../views/QueryItems.vue"),
    meta: {
      breadcrumb: [{ name: "Query" }],
    },
  },
  {
    path: "/query/:query",
    name: "QueryWithParams",
    component: () => import("../views/QueryItems.vue"),
    meta: {
      breadcrumb: [{ name: "Query" }],
    },
  },
  {
    path: "/attributetemplates",
    name: "AttributeTemplates",
    component: () => import("../views/AttributeTemplates.vue"),
    meta: {
      breadcrumb: [{ name: "Attribute templates" }],
    },
  },
  {
    path: "/blogs",
    name: "Blogs",
    component: () => import("../views/BlogsList.vue"),
    meta: {
      breadcrumb: [{ name: "Blogs" }],
    },
  },
  {
    path: "/blogs/:id",
    name: "BlogView",
    component: () => import("../views/BlogView.vue"),
    meta: {
      breadcrumb: [
        { name: "Blogs", href: "Blogs" },
      ],
    },
  },
  {
    path: "/newsletters",
    name: "Newsletters",
    component: () => import("../views/NewsletterList.vue"),
    meta: {
      breadcrumb: [{ name: "Newsletters" }],
    },
  },
  {
    path: "/newsletters/:id",
    name: "NewsletterView",
    component: () => import("../views/NewsletterView.vue"),
    meta: {
      breadcrumb: [
        { name: "Newsletters", href: "Newsletters" },
      ],
    },
  },
  {
    path: "/pages",
    name: "Pages",
    component: () => import("../views/PagesList.vue"),
    meta: {
      breadcrumb: [{ name: "Pages" }],
    },
  },
  {
    path: "/pages/:id",
    name: "PageView",
    component: () => import("../views/PageView.vue"),
    meta: {
      breadcrumb: [
        { name: "Pages", href: "Pages" },
      ],
    },
  },
  {
    path: "/blogs/:id/:articleId",
    name: "ArticleView",
    component: () => import("../views/ArticleView.vue"),
    meta: {
      breadcrumb: [
        { name: "Blogs", href: "Blogs" },
      ],
    },
  },
  {
    path: "/editattributetemplate/:id",
    name: "EditAttributeTemplate",
    component: () => import("../views/EditAttributeTemplate.vue"),
    meta: {
      breadcrumb: [{ name: "Edit attribute template" }],
    },
  },
  {
    path: "/purchasables",
    name: "Purchasables",
    component: () => import("../views/Purchasables.vue"),
    meta: {
      breadcrumb: [{ name: "Purchasables" }],
    },
  },
  {
    path: "/tables",
    name: "Tables",
    component: () => import("../views/Tables.vue"),
    meta: {
      breadcrumb: [{ name: "Tables" }],
    },
  },
  {
    path: "/jobs",
    name: "Jobs",
    component: () => import("../views/Jobs.vue"),
    meta: {
      breadcrumb: [{ name: "Jobs" }],
    },
  },
  {
    path: "/myprofile",
    name: "MyProfile",
    component: () => import("../views/MyProfile.vue"),
    meta: {
      breadcrumb: [{ name: "My Profile" }],
    },
  },
  {
    path: "/myspace",
    name: "MySpace",
    component: () => import("../views/MySpace.vue"),
    meta: {
      breadcrumb: [{ name: "My Space" }],
    },
  },
  {
    path: "/users",
    name: "Users",
    component: () => import("../views/Users.vue"),
    meta: {
      breadcrumb: [{ name: "Users" }],
    },
  },
  {
    path: "/groups",
    name: "Groups",
    component: () => import("../views/Groups.vue"),
    meta: {
      breadcrumb: [{ name: "Groups" }],
    },
  },
  {
    path: "/createuser",
    name: "CreateUser",
    component: () => import("../views/CreateUser.vue"),
    meta: {
      breadcrumb: [{ name: "Users", href: "Users" }, { name: "Create User" }],
    },
  },
  {
    path: "/edituser/:id",
    name: "EditUser",
    component: () => import("../views/EditUser.vue"),
    meta: {
      breadcrumb: [{ name: "Users", href: "Users" }, { name: "Edit User" }],
    },
  },
  {
    path: "/editgroup/:id",
    name: "EditGroup",
    component: () => import("../views/EditGroup.vue"),
    meta: {
      breadcrumb: [{ name: "Groups", href: "Groups" }, { name: "Edit Group" }],
    },
  },
  {
    path: "/login",
    name: "Login",
    component: () => import("../views/core/Login.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("../views/core/Register.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/forgotpassword",
    name: "ForgotPassword",
    component: () => import("../views/core/ForgotPassword.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/newpassword/:token",
    name: "SetNewPassword",
    component: () => import("../views/core/SetNewPassword.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/registrationsuccess",
    name: "RegistrationSuccessful",
    component: () => import("../views/core/RegistrationSuccessful.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/emailconfirmation/:token",
    name: "EmailConfirmation",
    component: () => import("../views/core/EmailConfirmation.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/emailchangedconfirmation/:token",
    name: "EmailChangedConfirmation",
    component: () => import("../views/core/EmailChangedConfirmation.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
  {
    path: "/invitation/:token",
    name: "Invitation",
    component: () => import("../views/core/Invitation.vue"),
    meta: {
      allowAnonymous: true,
    },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  if (to.matched.some((record) => !record.meta.allowAnonymous)) {
    store.dispatch("loadSettings").then(function () {
      if (!store.state.authenticated) {
        next({ name: "Login" });
      } else {
        next();
      }
    });
  } else {
    next();
  }
});

export default router;
