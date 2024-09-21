'use strict'
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export default {
  quaternionToEuler: function (quaternion) {
    const qx = quaternion.x
    const qy = quaternion.y
    const qz = quaternion.z
    const qw = quaternion.w

    let roll, pitch, yaw

    // Roll (x-axis rotation)
    const sinr_cosp = 2.0 * (qw * qx + qy * qz)
    const cosr_cosp = 1.0 - 2.0 * (qx * qx + qy * qy)
    roll = Math.atan2(sinr_cosp, cosr_cosp)

    // Pitch (y-axis rotation)
    const sinp = 2.0 * (qw * qy - qz * qx)
    if (Math.abs(sinp) >= 1) {
      pitch = (Math.PI / 2) * Math.sign(sinp)
    } else {
      pitch = Math.asin(sinp)
    }

    // Yaw (z-axis rotation)
    const siny_cosp = 2.0 * (qw * qz + qx * qy)
    const cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
    yaw = Math.atan2(siny_cosp, cosy_cosp)

    return { x: roll, y: pitch, z: yaw }
  },

  eulerToQuaternion: function (euler) {
    const roll = euler.x
    const pitch = euler.y
    const yaw = euler.z

    const cy = Math.cos(yaw * 0.5)
    const sy = Math.sin(yaw * 0.5)
    const cp = Math.cos(pitch * 0.5)
    const sp = Math.sin(pitch * 0.5)
    const cr = Math.cos(roll * 0.5)
    const sr = Math.sin(roll * 0.5)

    const qw = cy * cp * cr + sy * sp * sr
    const qx = cy * cp * sr - sy * sp * cr
    const qy = sy * cp * sr + cy * sp * cr
    const qz = sy * cp * cr - cy * sp * sr

    return { x: qx, y: qy, z: qz, w: qw }
  },

  eulerRadToDegRounded(euler) {
    return {
      x: Math.round((euler.x * 18000) / Math.PI / 100),
      y: Math.round((euler.y * 18000) / Math.PI / 100),
      z: Math.round((euler.z * 18000) / Math.PI / 100),
    }
  },

  eulerDegToRad(euler) {
    return {
      x: (euler.x / 180) * Math.PI,
      y: (euler.y / 180) * Math.PI,
      z: (euler.z / 180) * Math.PI,
    }
  },
}
