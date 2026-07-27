# Data source audit

Audited 2026-07-27 before the information dashboard was built.

| Source | Data | Structured | Reachable | Current | Verdict |
|---|---|---:|---:|---:|---|
| Yahoo Finance chart API (`^JKSE`) | Daily IDX Composite prices | JSON | Yes, HTTP 200 | Yes | Use with delayed-data label |
| Google News RSS (`IHSG when:7d`) | Market headlines | RSS/XML | Yes, HTTP 200 | Yes | Use as linked headline index |
| `presidenri.go.id` pages | Speech records | HTML | Intermittent 403/timeouts | Yes | Curate individual official links; no automated schedule claims |
| `setkab.go.id` pages | Speech records | HTML | Yes; RSS TLS unreliable | Yes | Curate official links; no RSS dependency |

## Accuracy boundary

Official sites reliably document speeches after they happen but do not expose a
stable, machine-readable forward calendar. The UI must say **no confirmed
upcoming speech** when the curated dataset has no future confirmed event. It
must never infer or invent one.

All current event records have date-level precision, not verified start times.
Therefore the impact study reports:

- previous trading close → event trading-day close;
- event trading-day close → next trading close.

It does **not** claim 30-minute before/after impact. If timestamped events and
intraday data become available later, they require an explicit `precision:
"timestamp"` record and separate calculations.

Yahoo Finance data is delayed and may be unavailable or revised. Headlines
remain links to their publishers; this project does not republish article
content. Correlation around a speech date is not evidence of causation.
