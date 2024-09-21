"use strict";
//----------------------------------------------
// _____ _____ _____ __    _____ _____ _____
// |   | |  |  |     |  |  |   __|  |  |   __|
// | | | |  |  |   --|  |__|   __|  |  |__   |
// |_|___|_____|_____|_____|_____|_____|_____|
//
//      Copyright 2019- mindcraft GmbH
// ---------------------------------------------

const JobStatePending = 0;
const JobStateRunning = 1;
const JobStateFailed = 2;
const JobStateSucceeded = 3;

export { JobStatePending, JobStateRunning, JobStateFailed, JobStateSucceeded };

export default class NkJobManager {

    constructor(nkclient) {
        this.nkclient = nkclient;
        this.jobs = new Map();
    }

    getJobs() {
        return this.jobs.values();
    }

    async execute(type, elements, parameters, progressCallback) {
        const _this = this;
        return new Promise(async (resolve, reject) => {
            try {
                const watchJob = async () => {
                    try {
                        jobEntry.job = await _this.nkclient.getJobState(id);
                        console.log("Job state: ", jobEntry.job);

                        let done = false;
                        switch(jobEntry.job.state) {
                            case JobStatePending:
                            case JobStateRunning:
                                try {
                                    if (progressCallback)
                                        progressCallback(jobEntry.job);
                                }
                                catch(err) {
                                    console.error("Error calling progress callback: ", err);
                                }
                                break;

                            case JobStateFailed:
                            case JobStateSucceeded:
                                console.log("Job is done.");
                                done = true;
                                resolve(jobEntry.job);
                                break;
                        }

                        if (!done) {
                            jobEntry.nextCheckMs = Math.min(jobEntry.nextCheckMs * 2, 8000);
                            setTimeout(watchJob, jobEntry.nextCheckMs);
                        } else {
                            _this.jobs.delete(id);
                        }
                    }
                    catch(err) {
                        console.error("Error fetching job state: " + err);
                    }
                }

                const id = await _this.nkclient.createJob({
                    type: type,
                    elements: elements,
                    parameters: parameters,
                });

                const jobEntry = {
                    id: id,
                    job: null,
                    nextCheckMs: 1000
                };

                _this.jobs.set(id, jobEntry);
                setTimeout(watchJob, jobEntry.nextCheckMs);
            }
            catch(err) {
                reject(err);
            }
        });
    }

}
