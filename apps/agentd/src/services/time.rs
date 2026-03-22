use std::time::{SystemTime, UNIX_EPOCH};

use traffic_cat_domain::UnixMillis;

pub fn unix_millis_now() -> UnixMillis {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    let millis = duration.as_millis();
    i64::try_from(millis).unwrap_or(i64::MAX)
}
