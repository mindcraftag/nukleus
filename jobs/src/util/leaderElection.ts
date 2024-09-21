import * as http from "http";
import * as os from "os";
import * as k8s from "@kubernetes/client-node";
import { Logger } from "log4js";

const kc = new k8s.KubeConfig();
kc.loadFromDefault();

const k8sApi = kc.makeApiClient(k8s.CoreV1Api);

type LeaderInfo = {
  thisNodeIsLeader: boolean;
  leaderHostname: string;
  leaderName: string;
};

export async function getReplicasInRS(podName: string, namespace: string) {
  const { body } = await k8sApi.listNamespacedPod(namespace);

  let replicaSetName: string | undefined;
  let numReplicas: number | undefined;

  for (const a of body.items) {
    if (a.metadata?.name === podName && a.metadata.ownerReferences) {
      for (const ow of a.metadata.ownerReferences) {
        if (ow.kind === "ReplicaSet") {
          replicaSetName = ow.name;
        }
      }
    }
  }

  if (replicaSetName) {
    const k8sApi1 = kc.makeApiClient(k8s.AppsV1Api);
    const { body } = await k8sApi1.listNamespacedReplicaSet(namespace);

    for (const a of body.items) {
      if (a.metadata?.name === replicaSetName) {
        numReplicas = a.status?.replicas;
      }
    }
  }

  return numReplicas;
}

export async function getPodIP(podName: string, namespace: string) {
  const { body } = await k8sApi.listNamespacedPod(namespace);

  for (const a of body.items) {
    if (a.metadata?.name === podName) {
      return a.status?.podIP;
    }
  }

  return null;
}

export async function waitForLeaderInfo(logger: Logger, namespace: string): Promise<LeaderInfo> {
  let info: LeaderInfo | null = null;
  while (!info) {
    try {
      info = await getLeaderInfo(logger, namespace);
    } catch {
      logger.warn("Unable to get Leader info");
    }
  }
  return info;
}

function getLeaderInfo(logger: Logger, namespace: string): Promise<LeaderInfo> {
  return new Promise<LeaderInfo>((resolve, reject) => {
    http.get(
      {
        host: "localhost",
        path: "/",
        port: 4040,
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data = data + chunk;
        });
        response.on("end", async () => {
          const json = JSON.parse(data);
          const podIP = await getPodIP(json.name, namespace);

          if (!podIP) {
            logger.error("Can't find PodIP for Pod " + json.name);
            return;
          }

          if (json.name === os.hostname()) {
            resolve({
              thisNodeIsLeader: true,
              leaderHostname: podIP,
              leaderName: json.name,
            });
          } else if (json.name) {
            resolve({
              thisNodeIsLeader: false,
              leaderHostname: podIP,
              leaderName: json.name,
            });
          } else {
            reject();
          }
        });
      }
    );
  });
}
