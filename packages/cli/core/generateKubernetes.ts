import { Plan, ServiceConfig } from "../types/plan";
import path from "path";
import fs from "fs-extra";
interface kubernetesHints {
    serviceOverlays?: Record<string, string>;
}

export async function generateKubernetesFormPlan(
    plan: Plan,
    hints: kubernetesHints = {}
) {
  const baseDir = path.resolve("infra/kubernetes");
  if(!(await fs.exists(baseDir))){
    await fs.mkdirp(baseDir);
  }

  for(const service of plan.services){
    const svcDir = path.join(baseDir, service.name);
    await fs.mkdirp(svcDir);

    const manifest = renderServiceDeployment(plan, service, hints);
    await fs.writeFile(path.join(svcDir, "deployment.yaml"), manifest);
  }
}

function renderServiceDeployment(
    plan: Plan,
    service: ServiceConfig,
    hints: kubernetesHints
): string {
    const cpuTarget = service?.autoscaling?.[0].target ?? 70;
    const replicas = service?.autoscaling?.[0].maxReplicas ?? 1;

    return `apiVersion: apps/v1
            kind: Deployment
            metadata:
            name: ${service.name}
            labels:
                app: ${service.name}
            spec:
            replicas: ${replicas}
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
                    image: REPLACE_ME/${service.name}:latest
                    env:
            ${Object.entries(service.env ?? {})
            .map(([k, v]) => `            - name: ${k}\n              value: "${v}"`)
            .join("\n")}
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
            minReplicas: ${service.autoscaling?.[0]?.minReplicas ?? 1}
            maxReplicas: ${service.autoscaling?.[0]?.maxReplicas ?? 3}
            metrics:
                - type: Resource
                resource:
                    name: cpu
                    target:
                    type: Utilization
                    averageUtilization: ${cpuTarget}
            `;

}