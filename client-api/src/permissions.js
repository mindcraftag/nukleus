'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export function verifyAcl(userInfo, acls, action) {
    if (userInfo.admin || userInfo.superadmin)
        return true

    if (!Array.isArray(acls))
        return true

    for (const acl of acls) {
        if (acl.can.includes(action)) {
            if (!acl.user && !acl.group)
                return true

            if (acl.user && acl.user === userInfo._id)
                return true

            if (acl.group) {
                for (const group of userInfo.groups) {
                    if (group === acl.group)
                        return true
                }
            }
        }
    }
}

export function hasPermission(userInfo, perm, needsSuperadmin) {
    if (userInfo.admin && !needsSuperadmin) {
        return true

    } else if (userInfo.superadmin) {
        return true
    } else if (Array.isArray(userInfo.permissions)) {
        if (Array.isArray(perm)) {
            for (const permission of userInfo.permissions) {
                for (const p of perm) {
                    if (permission === p) {
                        return true
                    }
                }
            }
        } else {
            for (const permission of userInfo.permissions) {
                if (permission === perm) {
                    return true
                }
            }
        }
    }

    return false
}
