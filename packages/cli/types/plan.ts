export type CloudProvider = "aws" | "gcp" | "azure";

export type DeploymentMode = "kubernetes" | "serverless" | "hybrid";

export type ServiceRuntime = "node" | "python" | "go" | "docker";

export interface AutoscalingRule {
  metric: "cpu" | "memory" | "rps" | "latency" | "queue_depth";
  target: number;
  minReplicas: number;
  maxReplicas: number;
  cooldownSeconds?: number;
}

export interface CostConstraint {
  monthlyBudgetUsd: number;
  hardLimit: boolean;
  alertThresholds: number[];
}

export interface RetentionPolicy {
  logsDays?: number;
  metricsDays?: number;
  backupsDays?: number;
}

export interface CronJob {
  name: string;
  schedule: string;
  targetService: string;
  handler: string;
  timeoutSeconds?: number;
}

export interface MonitoringThreshold {
  name: string;
  metric: string;
  threshold: number;
  comparison: ">" | ">=" | "<" | "<=";
  window: string; 
  severity: "warning" | "critical";
}

export interface ServiceConfigBase {
  name: string;
  runtime: ServiceRuntime;
  path: string;
  image?: string;
  env?: Record<string, string>;
  autoscaling?: AutoscalingRule[];
  monitoring?: MonitoringThreshold[];
}

export interface ApiServiceConfig extends ServiceConfigBase {
  type: "api";
  ports?: number[];
  public?: boolean;
  domain?: string;
}

export interface WorkerServiceConfig extends ServiceConfigBase {
  type: "worker";
  queue: string;
  concurrency?: number;
}

export interface QueueConfig {
  name: string;
  type: "sqs" | "pubsub" | "rabbitmq" | "kafka";
  retentionSeconds?: number;
  visibilityTimeoutSeconds?: number;
}

export interface JobConfig {
  name: string;
  type: "cron" | "oneoff";
  schedule?: string;
  targetService: string;
  handler: string;
}

export type ServiceConfig = ApiServiceConfig | WorkerServiceConfig;

export interface Plan {
  project?: string
  version: string;
  cloud: CloudProvider;
  region: string;
  deploymentMode: DeploymentMode;

  autoscalingDefaults?: AutoscalingRule[];
  cost: CostConstraint;
  retention: RetentionPolicy;


  services: ServiceConfig[];
  queues?: QueueConfig[];
  jobs?: JobConfig[];
  crons?: CronJob[];

  monitoring: {
    thresholds: MonitoringThreshold[];
  };

  // metadata for self-healing
  selfHealing: {
    enabled: boolean;
    driftDetectionIntervalMinutes: number;
    maxAutoFixesPerRun: number;
  };
}
