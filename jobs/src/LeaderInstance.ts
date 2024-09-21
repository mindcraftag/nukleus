import { Axios } from "axios";
import * as k8s from "@kubernetes/client-node";
import * as nsvc from "@mindcraftgmbh/nukleus-service";
import { sleep } from "./common/tools";
import { Logger } from "log4js";
import { Leader } from "./leader/Leader";

export class LeaderInstance {
  electionPodPort: number;
  leaderInstance: Leader | null;
  systemUserId: string;
  k8sApi: k8s.CoreV1Api;
  logger: Logger;
  currentLeaderHost: string | null;
  axios: Axios;
  updateInterval: NodeJS.Timeout;
  hostname: string;
  k8sNamespace: string;

  constructor(
    electionPodPort: number,
    k8sApi: k8s.CoreV1Api,
    logger: Logger,
    systemUserId: string,
    axios: Axios,
    hostname: string,
    k8sNamespace: string
  ) {
    this.electionPodPort = electionPodPort;

    this.k8sApi = k8sApi;
    this.k8sNamespace = k8sNamespace;
    this.logger = logger;
    this.systemUserId = systemUserId;
    this.axios = axios;
    this.hostname = hostname;

    this.leaderInstance = null;
    this.currentLeaderHost = null;

    this.update();
    this.updateInterval = setInterval(this.update.bind(this), 1000);
  }

  async update() {
    const info = await this.getLeaderInfo();

    // If this pod should be a leader, but hasn't started a leader instance yet
    if (info.isLeader && this.leaderInstance === null) {
      this.logger.info("Starting leader.");
      nsvc.model.startPropagatingChanges();
      this.leaderInstance = new Leader(this.logger);
    }

    // If this node was a leader but shouldn't be anymore.
    if (!info.isLeader && this.leaderInstance !== null) {
      this.logger.info("Stopping leader.");
      nsvc.model.stopPropagatingChanges();
      this.leaderInstance.stop();
      this.leaderInstance = null;
    }
  }

  private async getPodIP(podName: string) {
    const { body } = await this.k8sApi.listNamespacedPod(this.k8sNamespace);

    for (const a of body.items) {
      if (a.metadata?.name === podName && a.status?.podIP) {
        return a.status?.podIP;
      }
    }

    throw new Error("Did not find IP for pod with name " + podName + " in namespace " + this.k8sNamespace);
  }

  stop() {
    clearInterval(this.updateInterval);
    this.leaderInstance?.stop();
  }

  async attemptLeaderInfo() {
    const res = await this.axios.get("http://localhost:" + this.electionPodPort, {
      responseType: "json",
    });

    const name = res.data.name;
    if (typeof name !== "string" || name.length === 0) {
      throw new Error();
      return;
    }

    const isLeader = name === this.hostname;
    const podIP = await this.getPodIP(name);

    return {
      isLeader: isLeader,
      leaderHost: podIP,
    };
  }

  async getLeaderInfo() {
    while (true) {
      try {
        const leaderInfo = await this.attemptLeaderInfo();

        if (leaderInfo) {
          return leaderInfo;
        }
      } catch (_e) {
        // An Error might occur when the request fails, in that case we just keep trying.
      }
      await sleep(1000);
    }
  }
}
