//! Bounded host-side browser dev event buffer.
//!
//! This stores recent browser events for SDK inspection. It is intentionally
//! read-only from the agent perspective: querying events must not mutate browser
//! lifecycle state except when the caller explicitly clears matching buffered
//! rows.

use std::collections::VecDeque;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

/// Default number of events retained per backend.
pub const DEFAULT_DEV_EVENT_CAPACITY: usize = 500;

/// Default maximum serialized event params retained per row.
pub const DEFAULT_DEV_EVENT_PARAM_BYTES: usize = 16 * 1024;

/// Synthetic tab id used for backend-level diagnostics visible from tab queries.
pub const GLOBAL_DEV_EVENT_TAB_ID: &str = "__host__";

/// One browser dev event buffered by the host.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct DevEvent {
    /// Monotonic insertion sequence.
    pub sequence: u64,
    /// Unix timestamp in milliseconds.
    pub timestamp: u128,
    /// Host tab id string used by SDK calls.
    pub tab_id: String,
    /// open-browser-use session id when known.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    /// Event method, for example `Runtime.consoleAPICalled` or `onDownloadChange`.
    pub method: String,
    /// Event parameters after upstream redaction/bounds.
    pub params: Value,
    /// True when `params` had to be summarized because it exceeded the byte cap.
    #[serde(default)]
    pub params_truncated: bool,
}

/// Query over buffered events.
pub struct DevEventQuery<'a> {
    /// Required tab id.
    pub tab_id: &'a str,
    /// Optional session id fence.
    pub session_id: Option<&'a str>,
    /// Empty means all methods.
    pub methods: &'a [&'a str],
    /// Maximum matching events to return.
    pub max_entries: usize,
    /// Remove matching rows after reading.
    pub clear: bool,
}

#[derive(Default)]
struct Inner {
    next_sequence: u64,
    rows: VecDeque<DevEvent>,
}

/// Thread-safe bounded event ring.
pub struct DevEventBuffer {
    capacity: usize,
    max_params_bytes: usize,
    inner: Mutex<Inner>,
}

impl DevEventBuffer {
    /// Create a bounded buffer.
    pub fn new(capacity: usize) -> Self {
        Self::new_with_param_limit(capacity, DEFAULT_DEV_EVENT_PARAM_BYTES)
    }

    /// Create a bounded buffer with an explicit per-row serialized params limit.
    pub fn new_with_param_limit(capacity: usize, max_params_bytes: usize) -> Self {
        Self {
            capacity: capacity.max(1),
            max_params_bytes: max_params_bytes.max(128),
            inner: Mutex::new(Inner::default()),
        }
    }

    /// Append one event.
    pub fn record(
        &self,
        tab_id: impl Into<String>,
        session_id: Option<&str>,
        method: impl Into<String>,
        params: Value,
    ) {
        let mut inner = self.inner.lock().expect("dev event buffer lock");
        inner.next_sequence = inner.next_sequence.wrapping_add(1);
        let sequence = inner.next_sequence;
        let (params, params_truncated) = bound_params(params, self.max_params_bytes);
        inner.rows.push_back(DevEvent {
            sequence,
            timestamp: now_ms(),
            tab_id: tab_id.into(),
            session_id: session_id.map(str::to_owned),
            method: method.into(),
            params,
            params_truncated,
        });
        while inner.rows.len() > self.capacity {
            inner.rows.pop_front();
        }
    }

    /// Query recent matching events, oldest to newest.
    pub fn query(&self, query: DevEventQuery<'_>) -> Vec<DevEvent> {
        let mut inner = self.inner.lock().expect("dev event buffer lock");
        let max_entries = query.max_entries.max(1);
        let mut rows = inner
            .rows
            .iter()
            .filter(|row| matches_query(row, &query))
            .cloned()
            .collect::<Vec<_>>();
        if rows.len() > max_entries {
            rows = rows.split_off(rows.len() - max_entries);
        }
        if query.clear {
            inner
                .rows
                .retain(|row| !matches_query_for_clear(row, &query));
        }
        rows
    }
}

impl Default for DevEventBuffer {
    fn default() -> Self {
        Self::new(DEFAULT_DEV_EVENT_CAPACITY)
    }
}

fn bound_params(params: Value, max_bytes: usize) -> (Value, bool) {
    let Ok(serialized) = serde_json::to_string(&params) else {
        return (
            bounded_summary(
                "unserializable event params",
                value_type(&params),
                0,
                max_bytes,
            ),
            true,
        );
    };
    if serialized.len() <= max_bytes {
        return (params, false);
    }
    let serialized_bytes = serialized.len();
    let summary = truncate_utf8_prefix(&serialized, max_bytes);
    (
        bounded_summary(summary, value_type(&params), serialized_bytes, max_bytes),
        true,
    )
}

fn bounded_summary(
    summary: &str,
    original_type: &str,
    serialized_bytes: usize,
    max_bytes: usize,
) -> Value {
    let mut end = floor_char_boundary(summary, summary.len().min(max_bytes));
    loop {
        let candidate = json!({
            "truncated": true,
            "original_type": original_type,
            "serialized_bytes": serialized_bytes,
            "summary": &summary[..end],
        });
        if serde_json::to_string(&candidate)
            .map(|raw| raw.len() <= max_bytes)
            .unwrap_or(false)
            || end == 0
        {
            return candidate;
        }
        end = floor_char_boundary(summary, end.saturating_sub(1));
    }
}

fn truncate_utf8_prefix(value: &str, max_bytes: usize) -> &str {
    &value[..floor_char_boundary(value, value.len().min(max_bytes))]
}

fn floor_char_boundary(value: &str, mut index: usize) -> usize {
    while index > 0 && !value.is_char_boundary(index) {
        index -= 1;
    }
    index
}

fn value_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null",
        Value::Bool(_) => "boolean",
        Value::Number(_) => "number",
        Value::String(_) => "string",
        Value::Array(_) => "array",
        Value::Object(_) => "object",
    }
}

fn matches_query(row: &DevEvent, query: &DevEventQuery<'_>) -> bool {
    matches_query_for_read(row, query)
}

fn matches_query_for_read(row: &DevEvent, query: &DevEventQuery<'_>) -> bool {
    let is_global_diagnostic = row.tab_id == GLOBAL_DEV_EVENT_TAB_ID;
    (row.tab_id == query.tab_id || is_global_diagnostic)
        && (is_global_diagnostic
            || query
                .session_id
                .map(|session_id| row.session_id.as_deref() == Some(session_id))
                .unwrap_or(true))
        && (query.methods.is_empty() || query.methods.iter().any(|method| row.method == *method))
}

fn matches_query_for_clear(row: &DevEvent, query: &DevEventQuery<'_>) -> bool {
    let explicit_global_query = query.tab_id == GLOBAL_DEV_EVENT_TAB_ID;
    row.tab_id == query.tab_id
        && (explicit_global_query
            || query
                .session_id
                .map(|session_id| row.session_id.as_deref() == Some(session_id))
                .unwrap_or(true))
        && (query.methods.is_empty() || query.methods.iter().any(|method| row.method == *method))
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{DevEventBuffer, DevEventQuery};

    #[test]
    fn query_filters_by_tab_method_and_session() {
        let buffer = DevEventBuffer::new(4);
        buffer.record(
            "tab-1",
            Some("session-a"),
            "Runtime.consoleAPICalled",
            json!({"args": []}),
        );
        buffer.record(
            "tab-1",
            Some("session-b"),
            "Log.entryAdded",
            json!({"entry": {"text": "x"}}),
        );
        buffer.record(
            "tab-2",
            Some("session-a"),
            "Runtime.consoleAPICalled",
            json!({"args": []}),
        );

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: Some("session-a"),
            methods: &["Runtime.consoleAPICalled"],
            max_entries: 10,
            clear: false,
        });

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tab_id, "tab-1");
        assert_eq!(rows[0].session_id.as_deref(), Some("session-a"));
        assert_eq!(rows[0].method, "Runtime.consoleAPICalled");
    }

    #[test]
    fn buffer_is_bounded_and_clear_removes_only_matching_rows() {
        let buffer = DevEventBuffer::new(3);
        buffer.record("tab-1", Some("session-a"), "A", json!({"n": 1}));
        buffer.record("tab-1", Some("session-a"), "A", json!({"n": 2}));
        buffer.record("tab-2", Some("session-a"), "A", json!({"n": 3}));
        buffer.record("tab-1", Some("session-a"), "A", json!({"n": 4}));

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: Some("session-a"),
            methods: &[],
            max_entries: 10,
            clear: true,
        });

        assert_eq!(
            rows.iter()
                .map(|row| row.params["n"].as_i64().unwrap())
                .collect::<Vec<_>>(),
            vec![2, 4]
        );

        let remaining = buffer.query(DevEventQuery {
            tab_id: "tab-2",
            session_id: Some("session-a"),
            methods: &[],
            max_entries: 10,
            clear: false,
        });
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].params["n"], json!(3));
    }

    #[test]
    fn large_params_are_bounded_and_marked_truncated() {
        let buffer = DevEventBuffer::new_with_param_limit(4, 128);
        buffer.record(
            "tab-1",
            None,
            "Runtime.consoleAPICalled",
            json!({
                "args": [{ "value": "x".repeat(512) }]
            }),
        );

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: None,
            methods: &["Runtime.consoleAPICalled"],
            max_entries: 10,
            clear: false,
        });

        assert_eq!(rows.len(), 1);
        assert!(rows[0].params_truncated);
        assert_eq!(rows[0].params["truncated"], json!(true));
        assert_eq!(rows[0].params["original_type"], json!("object"));
        assert!(serde_json::to_string(&rows[0].params).unwrap().len() <= 128);
    }

    #[test]
    fn multibyte_params_are_bounded_without_invalid_utf8() {
        let buffer = DevEventBuffer::new_with_param_limit(4, 128);
        buffer.record(
            "tab-1",
            None,
            "Runtime.consoleAPICalled",
            json!({
                "args": [{ "value": "你好".repeat(512) }]
            }),
        );

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: None,
            methods: &["Runtime.consoleAPICalled"],
            max_entries: 10,
            clear: false,
        });

        assert_eq!(rows.len(), 1);
        assert!(rows[0].params_truncated);
        assert!(rows[0].params["summary"].as_str().is_some());
        assert!(serde_json::to_string(&rows[0].params).unwrap().len() <= 128);
    }

    #[test]
    fn tab_queries_include_global_diagnostics() {
        let buffer = DevEventBuffer::new(4);
        buffer.record(
            "__host__",
            None,
            "obu.dev_events.lagged",
            json!({"dropped": 7}),
        );

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: Some("session-a"),
            methods: &["obu.dev_events.lagged"],
            max_entries: 10,
            clear: false,
        });

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tab_id, "__host__");
        assert_eq!(rows[0].params["dropped"], json!(7));
    }

    #[test]
    fn tab_clear_does_not_clear_global_diagnostics() {
        let buffer = DevEventBuffer::new(4);
        buffer.record(
            "__host__",
            None,
            "obu.dev_events.lagged",
            json!({"dropped": 7}),
        );
        buffer.record(
            "tab-1",
            Some("session-a"),
            "Runtime.consoleAPICalled",
            json!({"args": []}),
        );

        let rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: Some("session-a"),
            methods: &[],
            max_entries: 10,
            clear: true,
        });

        assert_eq!(rows.len(), 2);
        assert!(rows.iter().any(|row| row.tab_id == "__host__"));
        assert!(rows.iter().any(|row| row.tab_id == "tab-1"));

        let globals = buffer.query(DevEventQuery {
            tab_id: "__host__",
            session_id: None,
            methods: &["obu.dev_events.lagged"],
            max_entries: 10,
            clear: false,
        });
        assert_eq!(globals.len(), 1);

        let tab_rows = buffer.query(DevEventQuery {
            tab_id: "tab-1",
            session_id: Some("session-a"),
            methods: &["Runtime.consoleAPICalled"],
            max_entries: 10,
            clear: false,
        });
        assert!(tab_rows.is_empty());
    }
}
