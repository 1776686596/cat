use traffic_cat_domain::{AgentHealthSnapshot, AlertRecord, UnixMillis, WidgetPetState};

use crate::request::SubscriptionTopic;
use crate::response::RealtimeSnapshot;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AgentEvent {
    RealtimeUpdated(RealtimeSnapshot),
    AlertRaised(AlertRecord),
    AlertResolved {
        alert_id: String,
        resolved_at: UnixMillis,
    },
    HealthUpdated(AgentHealthSnapshot),
    WidgetStateChanged {
        state: WidgetPetState,
        observed_at: UnixMillis,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EventEnvelope {
    pub topic: SubscriptionTopic,
    pub sequence: u64,
    pub emitted_at: UnixMillis,
    pub payload: AgentEvent,
}
