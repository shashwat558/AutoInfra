import { Plan } from "../types/plan";

export type DriftSeverity = "info" | "warning" | "critical"

export interface DriftIssue {
    id: string;
    resourceType: "terraform" | "kubernetes" | "plan"
    resourceId: string
    fieldPath: string
    expected: any
    actual: any
    severity: DriftSeverity
    fixStrategy: "apply" | "recreate" | "manual" | "update_plan";
}

export interface DriftReport {
    hasDrift: boolean
    issues: DriftIssue[];
}

export async function detectDrift(plan:Plan) {
    // - run terraform show -json to get current state
    // -run kubectl get ... -o json for live k8s
    // -normalize and compare with plan
    // for now , stubbing with empty report
    return {
        hasDrift: false,
        issues: []
    }
}