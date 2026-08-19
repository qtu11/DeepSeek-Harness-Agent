use serde_json::{Value, json};

use super::{AgentRuntimeKernelLifecycle, BackendInventory};

pub(super) fn browser_status_summary(
    sdk_bootstrap: &str,
    kernel_lifecycle: &AgentRuntimeKernelLifecycle,
    kernel_generation: u64,
    inventory: &BackendInventory,
    product_error: Option<&Value>,
) -> Value {
    let backend_count = inventory.backends.len();
    let has_webextension_backend = inventory
        .backends
        .iter()
        .any(|backend| backend.kind == "webextension");
    let kernel_actionable = kernel_allows_js(kernel_lifecycle);
    let actionable = sdk_bootstrap == "available"
        && backend_count > 0
        && product_error.is_none()
        && kernel_actionable;
    let product_next = product_error.and_then(|value| value.get("next_action"));
    let next_step = if actionable {
        json!({
            "kind": "use_js",
            "summary": "Browser environment is ready; use the js tool to create or select a tab and continue the web workflow."
        })
    } else if let Some(next_action) = product_next {
        json!({
            "kind": next_action.get("kind").and_then(Value::as_str).unwrap_or("manual"),
            "summary": next_action.get("summary").and_then(Value::as_str).unwrap_or("Inspect browser_status diagnostics."),
            "command": next_action.get("command").cloned().unwrap_or(Value::Null)
        })
    } else if !kernel_actionable && sdk_bootstrap == "available" && backend_count > 0 {
        kernel_next_step(kernel_lifecycle)
    } else {
        json!({
            "kind": "inspect_status",
            "summary": "Inspect browser_status diagnostics before browser automation."
        })
    };

    json!({
        "actionable": actionable,
        "state": if actionable {
            "ready"
        } else if sdk_bootstrap == "available" && backend_count > 0 && product_error.is_none() && kernel_busy(kernel_lifecycle) {
            "busy"
        } else {
            "blocked"
        },
        "host": {
            "state": if sdk_bootstrap == "available" { "ready" } else { "missing_sdk" },
            "sdk_bootstrap": sdk_bootstrap
        },
        "extension": {
            "state": if has_webextension_backend {
                "connected"
            } else if backend_count > 0 {
                "not_required"
            } else {
                "unavailable"
            },
            "backend_count": backend_count,
            "diagnostic_count": inventory.diagnostics.len()
        },
        "transport": {
            "state": if backend_count > 0 { "connected" } else { "unavailable" }
        },
        "kernel": {
            "state": kernel_state(kernel_lifecycle),
            "generation": kernel_generation
        },
        "next_step": next_step
    })
}

fn kernel_state(lifecycle: &AgentRuntimeKernelLifecycle) -> &'static str {
    match lifecycle {
        AgentRuntimeKernelLifecycle::Idle { .. } => "idle",
        AgentRuntimeKernelLifecycle::Spawning { .. } => "spawning",
        AgentRuntimeKernelLifecycle::Ready { .. } => "ready",
        AgentRuntimeKernelLifecycle::Executing { .. } => "executing",
        AgentRuntimeKernelLifecycle::Restarting { .. } => "restarting",
        AgentRuntimeKernelLifecycle::Failed { .. } => "failed",
    }
}

fn kernel_allows_js(lifecycle: &AgentRuntimeKernelLifecycle) -> bool {
    matches!(
        lifecycle,
        AgentRuntimeKernelLifecycle::Idle { .. } | AgentRuntimeKernelLifecycle::Ready { .. }
    )
}

fn kernel_busy(lifecycle: &AgentRuntimeKernelLifecycle) -> bool {
    matches!(
        lifecycle,
        AgentRuntimeKernelLifecycle::Spawning { .. }
            | AgentRuntimeKernelLifecycle::Executing { .. }
            | AgentRuntimeKernelLifecycle::Restarting { .. }
    )
}

fn kernel_next_step(lifecycle: &AgentRuntimeKernelLifecycle) -> Value {
    match lifecycle {
        AgentRuntimeKernelLifecycle::Spawning { .. }
        | AgentRuntimeKernelLifecycle::Restarting { .. } => json!({
            "kind": "wait",
            "summary": "The JavaScript kernel is starting or restarting; wait briefly and call browser_status again."
        }),
        AgentRuntimeKernelLifecycle::Executing { .. } => json!({
            "kind": "wait",
            "summary": "The JavaScript kernel is already executing a request; wait for the current js call to finish before starting another."
        }),
        AgentRuntimeKernelLifecycle::Failed { .. } => json!({
            "kind": "js_reset",
            "summary": "The JavaScript kernel failed; use js_reset, then call browser_status again."
        }),
        AgentRuntimeKernelLifecycle::Idle { .. } | AgentRuntimeKernelLifecycle::Ready { .. } => {
            json!({
                "kind": "use_js",
                "summary": "Browser environment is ready; use the js tool."
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use serde_json::{Value, json};

    use super::{AgentRuntimeKernelLifecycle, BackendInventory, browser_status_summary};
    use crate::repl_manager::DiscoveredBackend;

    fn inventory_with_backend_kind(kind: &str) -> BackendInventory {
        BackendInventory {
            backends: vec![DiscoveredBackend {
                kind: kind.into(),
                name: "chrome".into(),
                socket_path: "/tmp/obu.sock".into(),
                metadata: None,
            }],
            diagnostics: Vec::new(),
            auth_tokens: HashMap::new(),
        }
    }

    fn inventory_with_backend() -> BackendInventory {
        inventory_with_backend_kind("webextension")
    }

    fn summary_for_kernel(lifecycle: AgentRuntimeKernelLifecycle) -> Value {
        browser_status_summary("available", &lifecycle, 1, &inventory_with_backend(), None)
    }

    #[test]
    fn kernel_lifecycle_controls_next_step() {
        assert_eq!(
            summary_for_kernel(AgentRuntimeKernelLifecycle::Executing {
                generation: 1,
                exec_id: "exec-1".into(),
                turn_id: "turn-1".into(),
            })["next_step"]["kind"],
            json!("wait")
        );
        assert_eq!(
            summary_for_kernel(AgentRuntimeKernelLifecycle::Failed {
                generation: 1,
                stage: "spawn",
                error_message: "boom".into(),
                recovered: false,
            })["next_step"]["kind"],
            json!("js_reset")
        );
    }

    #[test]
    fn cdp_backend_does_not_claim_extension_connected() {
        let summary = browser_status_summary(
            "available",
            &AgentRuntimeKernelLifecycle::Ready { generation: 1 },
            1,
            &inventory_with_backend_kind("cdp"),
            None,
        );

        assert_eq!(summary["actionable"], json!(true));
        assert_eq!(summary["transport"]["state"], json!("connected"));
        assert_eq!(summary["extension"]["state"], json!("not_required"));
    }
}
