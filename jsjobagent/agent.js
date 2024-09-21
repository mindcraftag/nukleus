"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const jobs      = require('./jobs');
const nsvc      = require('@mindcraftgmbh/nukleus-service');

exports.run = async function() {

  const jobAgent = nsvc.jobAgent.createJobAgent(jobs.getList(), {
    agentIdFile: nsvc.config.jobsystem.nukleus_id_file,
    agentName: "Maintenance Jobs Agent",
    agentPrefix: "JS",
    agentType: "JsJobAgent",
    agentVersion: require('./package.json').version,
    nukleusToken: nsvc.config.jobsystem.nukleus_token,
    jobSystemUrl: nsvc.config.jobsystem.nukleus_jobs_register_url,
    jobSystemWsUrl: nsvc.config.jobsystem.nukleus_jobs_ws_url
  });

  jobAgent.$on('exec', async function(msg, plugin) {

    const log = await nsvc.jobTools.executeJobPluginNoCatch(plugin, {
      elements: msg.elements,
      parameters: msg.parameters,
      api_token: msg.api_token,
      api_url: msg.api_url,
      client: msg.client,
      user: msg.user
    });

    jobAgent.sendSuccess(log);

  });

  return jobAgent;
}

exports.debug = async function(debugConfig) {
  let found = false;
  for (const job of jobs.getList()) {
    if (job.name === debugConfig.job_name) {
      await nsvc.jobTools.executeJobPluginNoCatch(job, debugConfig);
      found = true;
    }
  }
  if (!found) {
    console.error("Job not found: " + debugConfig.job_name);
  }
}
