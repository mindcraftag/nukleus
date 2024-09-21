"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

import moment from "moment";
import eventBus from "../eventbus";

const DEBUG_MODE = false;

export default class NkApiGateway {

  constructor(nkclient) {

    if (!nkclient)
      throw "A nukleus client needs to be passed.";

    this.nkclient = nkclient;
    this.debug = DEBUG_MODE;
    if (this.debug) {
      this.apiCalls = [];
      this.apiCallsStartTime = null;
    }
  }

  start() {
    if (this.debug) {
      this.apiCallsStartTime = moment();
      this.apiCalls = [];
    }
  }

  end() {
    if (this.debug) {
      console.log("Calls: " + this.apiCalls.length);
      for (const call of this.apiCalls) {
        const callTime = call.callTime.toString().padStart(6, ' ');
        const totalTime = call.totalTime.toString().padStart(6, ' ');

        console.log(callTime + totalTime + " -> " + call.caller + "::" + call.method + " (" + JSON.stringify(call.params) + ")");
      }
    }
  }

  async call(caller, method, ...params) {
    try {
      if (this.debug) {
        const startTime = moment();
        const result = await this.nkclient[method](...params);
        const endTime = moment();
        const callTime = endTime.diff(startTime, 'milliseconds');
        const totalTime = endTime.diff(this.apiCallsStartTime, 'milliseconds');

        this.apiCalls.push({
          caller: caller,
          method: method,
          params: params,
          callTime: callTime,
          totalTime: totalTime
        });

        //console.log(`[TIMING] API call ${method} by ${caller}: ${callTime}ms`);

        return result;
      } else {
        return this.nkclient[method](...params);
      }
    }
    catch(err) {
      eventBus.$emit('nk:client:fatalError', "API call failed: " + method);
      throw err;
    }
  }

}
