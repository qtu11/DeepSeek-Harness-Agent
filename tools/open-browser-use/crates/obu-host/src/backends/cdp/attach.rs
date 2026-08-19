//! Per-tab CDP session attach/detach.

use serde_json::{Value, json};

use crate::backends::cdp::CdpBackend;
use crate::error::{HostError, Result};
use crate::tab_state::{TabId, TabRecord, TabStatus};

/// Attach a flattened CDP session to a known tab.
pub async fn attach(backend: &CdpBackend, tab_id: &str) -> Result<()> {
    let id = TabId::new(tab_id);
    let record = require_active_record(backend, tab_id)?;
    if record.attached && record.cdp_session_id.is_some() {
        return Ok(());
    }

    let result = backend
        .transport()
        .send_command(
            "Target.attachToTarget",
            json!({ "targetId": record.target_id, "flatten": true }),
            None,
        )
        .await
        .map_err(HostError::from)?;
    let session_id = result
        .get("sessionId")
        .and_then(Value::as_str)
        .ok_or_else(|| HostError::Protocol("Target.attachToTarget missing sessionId".into()))?
        .to_string();

    backend.registry().update(&id, |record| {
        record.attached = true;
        record.cdp_session_id = Some(session_id.clone());
    })?;

    // Arm the domains that must be active from attach time. Page/DOM remain lazy,
    // but Runtime/Log need to be enabled before console/log events fire so
    // host-backed diagnostics are not silently empty.
    backend
        .transport()
        .send_command(
            "Emulation.setFocusEmulationEnabled",
            json!({ "enabled": true }),
            Some(&session_id),
        )
        .await
        .map_err(HostError::from)?;
    backend
        .transport()
        .send_command(
            "Target.setAutoAttach",
            json!({ "autoAttach": true, "flatten": true, "waitForDebuggerOnStart": false }),
            Some(&session_id),
        )
        .await
        .map_err(HostError::from)?;
    for method in ["Runtime.enable", "Log.enable"] {
        if let Err(error) = backend
            .transport()
            .send_command(method, json!({}), Some(&session_id))
            .await
            .map_err(HostError::from)
        {
            tracing::warn!(
                method,
                ?error,
                "CDP dev event domain enable failed; host log buffer may be incomplete"
            );
        }
    }
    Ok(())
}

/// Detach a flattened CDP session from a tab.
pub async fn detach(backend: &CdpBackend, tab_id: &str) -> Result<()> {
    let id = TabId::new(tab_id);
    let record = require_active_record(backend, tab_id)?;
    let Some(session_id) = record.cdp_session_id else {
        return Ok(());
    };

    backend
        .transport()
        .send_command(
            "Target.detachFromTarget",
            json!({ "sessionId": session_id }),
            None,
        )
        .await
        .map_err(HostError::from)?;

    backend.registry().update(&id, |record| {
        record.attached = false;
        record.cdp_session_id = None;
    })?;
    backend.registry().clear_tab_handles(&id)?;
    Ok(())
}

/// Return the attached CDP session id for a tab.
pub(crate) fn require_session(backend: &CdpBackend, tab_id: &str) -> Result<String> {
    let record = require_active_record(backend, tab_id)?;
    record
        .cdp_session_id
        .ok_or_else(|| HostError::TabNotAttached(format!("tab {tab_id} not attached")))
}

/// Return a known active tab record or reject parked lifecycle states.
pub(crate) fn require_active_record(backend: &CdpBackend, tab_id: &str) -> Result<TabRecord> {
    let record = backend
        .registry()
        .get(&TabId::new(tab_id))?
        .ok_or_else(|| HostError::PageClosed(format!("unknown tab {tab_id}")))?;
    if record.status != TabStatus::Active {
        return Err(HostError::Protocol(format!(
            "tab {tab_id} is {}, not actively controlled",
            tab_status_label(&record.status)
        )));
    }
    Ok(record)
}

fn tab_status_label(status: &TabStatus) -> &'static str {
    match status {
        TabStatus::Active => "active",
        TabStatus::Handoff => "handoff",
        TabStatus::Deliverable => "deliverable",
    }
}
