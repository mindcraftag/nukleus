"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

export const INTERVAL_NAMES = ["hourly", "minutely", "daily", "weekly", "monthly", "immediate"];

export const INTERVALS = [
  {
    name: "hourly",
    cronExp: "0 * * * *",
  },
  {
    name: "minutely",
    cronExp: "* * * * *",
  },
  {
    name: "daily",
    cronExp: "30 0 * * *",
  },
  {
    name: "weekly",
    cronExp: "0 1 * * 0",
  },
  {
    name: "monthly",
    cronExp: "0 2 0 * *",
  },
  {
    name: "immediate",
    cronExp: "*/5 * * * *",
  },
];

export const JobState = {
  PENDING: 0,
  RUNNING: 1,
  FAILED: 2,
  SUCCEEDED: 3,
  LOCKED: 4,
};

export const JOB_AGENT_ALIVE_TIMEOUT = 60 * 1000;
