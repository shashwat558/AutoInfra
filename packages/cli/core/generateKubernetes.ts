import { Plan, ServiceConfig } from "../types/plan";
import path from "path";
import fs from "fs-extra";

interface KubernetesHints {
  serviceOverlays?: Record<string, string>;
  raw?: string;
}

export async function generateKubernetesFormPlan(
  plan: Plan,
  hints: KubernetesHints | string = {}
) {
  const baseDir = path.resolve("infra/kubernetes");
  await fs.ensureDir(baseDir);

  if (typeof hints === "string") {
    await fs.writeFile(path.join(baseDir, "ai_generated.yaml"), hints, "utf-8");
  } else if (hints.raw) {
    await fs.writeFile(path.join(baseDir, "ai_generated.yaml"), hints.raw, "utf-8");
  }
  
  const hintsObj: KubernetesHints = typeof hints === "string" ? {} : hints;

  for (const service of plan.services) {
    const svcDir = path.join(baseDir, service.name);
    await fs.ensureDir(svcDir);

    const manifest = renderServiceDeployment(plan, service, hintsObj);
    await fs.writeFile(path.join(svcDir, "deployment.yaml"), manifest, "utf-8");
  }

  console.log("✅ Wrote Kubernetes manifests");
}

function renderServiceDeployment(
  plan: Plan,
  service: ServiceConfig,
  hints: KubernetesHints
): string {

  const aiOverlay = hints.serviceOverlays?.[service.name];
  if (aiOverlay) return aiOverlay;

  const minReplicas = service.autoscaling?.[0]?.minReplicas ?? 1;
  const maxReplicas = service.autoscaling?.[0]?.maxReplicas ?? 3;
  const cpuTarget = service.autoscaling?.[0]?.target ?? 70;

  const envLines = Object.entries(service.env ?? {})
    .map(([key, val]) => `        - name: ${key}\n          value: "${val}"`)
    .join("\n");

  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${service.name}
  labels:
    app: ${service.name}
spec:
  replicas: ${minReplicas}
  selector:
    matchLabels:
      app: ${service.name}
  template:
    metadata:
      labels:
        app: ${service.name}
    spec:
      containers:
        - name: ${service.name}
          image: ${service.image || `ghcr.io/${plan.project}/${service.name}:latest`}
${envLines ? "          env:\n" + envLines : ""}
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${service.name}-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${service.name}
  minReplicas: ${minReplicas}
  maxReplicas: ${maxReplicas}
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: ${cpuTarget}
`;
}
