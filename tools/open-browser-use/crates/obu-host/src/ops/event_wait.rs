//! Shared event wait loops.

use std::time::Duration;

use tokio::sync::broadcast;
use tokio::time::Instant;

use crate::error::{HostError, Result};

pub(crate) async fn wait_for_broadcast_event_matching<T, R, F, G>(
    rx: &mut broadcast::Receiver<T>,
    timeout_ms: u64,
    timeout_message: impl Into<String>,
    mut closed_error: G,
    mut match_event: F,
) -> Result<R>
where
    T: Clone,
    F: FnMut(T) -> Option<R>,
    G: FnMut(broadcast::error::RecvError) -> HostError,
{
    let timeout_message = timeout_message.into();
    let deadline = Instant::now() + Duration::from_millis(timeout_ms);
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Err(HostError::Timeout(timeout_message));
        }
        let event = match tokio::time::timeout(remaining, rx.recv())
            .await
            .map_err(|_| HostError::Timeout(timeout_message.clone()))?
        {
            Ok(event) => event,
            Err(broadcast::error::RecvError::Lagged(dropped)) => {
                tracing::warn!(
                    dropped,
                    "broadcast event receiver lagged; resynchronizing from retained events"
                );
                continue;
            }
            Err(error @ broadcast::error::RecvError::Closed) => return Err(closed_error(error)),
        };
        if let Some(result) = match_event(event) {
            return Ok(result);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn lagged_receiver_resynchronizes_and_matches_later_event() {
        let (tx, mut rx) = broadcast::channel(1);
        tx.send("missed-1").unwrap();
        tx.send("missed-2").unwrap();

        let waiter = tokio::spawn(async move {
            wait_for_broadcast_event_matching(
                &mut rx,
                1_000,
                "timed out waiting for target",
                |error| HostError::Protocol(format!("test bus closed: {error}")),
                |event| (event == "target").then_some(event),
            )
            .await
        });

        tokio::task::yield_now().await;
        tx.send("target").unwrap();

        let result = waiter.await.unwrap().unwrap();
        assert_eq!(result, "target");
    }

    #[tokio::test]
    async fn closed_receiver_uses_closed_error_mapper() {
        let (tx, mut rx) = broadcast::channel::<&str>(1);
        drop(tx);

        let error = wait_for_broadcast_event_matching(
            &mut rx,
            1_000,
            "timed out waiting for target",
            |error| HostError::Protocol(format!("test bus closed: {error}")),
            |event| (event == "target").then_some(event),
        )
        .await
        .unwrap_err();

        assert!(
            error
                .to_string()
                .contains("test bus closed: channel closed")
        );
    }
}
