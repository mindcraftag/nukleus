"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import store from "../store";

export default {
  userAccountInfoReady() {
    return new Promise((resolve, reject) => {
      let maxChecks = 100;

      function check() {
        if (store.state.me) {
          console.log("User account info is ready!");
          resolve();
        } else {
          maxChecks--;
          if (maxChecks > 0) setTimeout(check, 100);
          else reject("Timeout checking for user account information");
        }
      }
      check();
    });
  },

  verifyAcl(acls, action) {
    const user = store.state.me;

    if (user.admin || user.superadmin) return true;

    if (!Array.isArray(acls)) return true;

    for (const acl of acls) {
      if (acl.can.includes(action)) {
        if (!acl.user && !acl.group) return true;

        if (acl.user && acl.user === user._id) return true;

        if (acl.group) {
          for (const group of user.groups) {
            if (group === acl.group) return true;
          }
        }
      }
    }
  },

  isAdmin() {
    const me = store.state.me;
    if (me) {
      return me.admin || me.superadmin;
    } else {
      return null;
    }
  },

  hasPermission(perm, needsSuperadmin) {
    try {
      const me = store.state.me;
      if (me) {
        if (me.admin && !needsSuperadmin) {
          return true;
        } else if (me.superadmin) {
          return true;
        } else if (Array.isArray(me.permissions)) {
          if (Array.isArray(perm)) {
            for (const permission of me.permissions) {
              for (const p of perm) {
                if (permission === p) {
                  return true;
                }
              }
            }
          } else {
            for (const permission of me.permissions) {
              if (permission === perm) {
                return true;
              }
            }
          }
        }
      }
    } catch (err) {
      store.commit("setError", "Permissions unavailable: " + err.toString());
    }

    return false;
  },
};
