# Changelog

## v1.7

- Rejected latitude/longitude `0,0` everywhere.
- Added zero-coordinate database repair script.
- Added truthful location-source labels.
- Added secure agent-phone live GPS links.
- Added `BrokerAgentLocationDevice` and `BrokerAgentLocationPing` models.
- Added agent location sharing page and API.
- Added live-agent freshness tracking.
- Kept one Staff pointer for the logged-in Staff Officer.
- Added GPS accuracy validation for Staff and agent updates.
- Added automatic Service Visits refresh event and 15-second polling.
- Added Staff-owned Service Visit editing with linked ServiceActivity updates.
- Kept exact GPS markers unshifted; only approximate address markers may be visually separated.
