# Data source audit

Audited 2026-07-27 before the information dashboard was built.

| Source | Data | Structured | Reachable | Current | Verdict |
|---|---|---:|---:|---:|---|
| Yahoo Finance chart API (`^JKSE`) | One-minute quote metadata + daily IDX Composite history | JSON | Yes, HTTP 200 | Yes | Refresh hourly on weekdays; retain delayed-data label |
| Yahoo Finance chart API (`IDR=X`) | USD/IDR quote, daily move, and daily history | JSON | Yes, HTTP 200 | Yes | Refresh with IHSG; expose independent stale/last-quote state and event windows |
| Google News RSS (`IHSG when:7d`) | IHSG headlines | RSS/XML | Yes, HTTP 200 | Yes | Use as linked headline index with full Jakarta publication date/time |
| Google News RSS (`(saham OR emiten) (BEI OR IDX) when:3d`) | Stock, issuer, corporate-action, and IDX news | RSS/XML | Yes, HTTP 200 | Yes | Use as an independent linked stock-news index |
| Google News RSS (`Bank Indonesia`, inflation, rupiah, commodities, global-market terms) | Macro-market news | RSS/XML | Yes, HTTP 200 | Yes | Use as an independent linked macro index; do not infer numerical indicators from headlines |
| `presidenri.go.id` pages | Speech records | HTML | Intermittent 403/timeouts | Yes | Curate individual official links; no automated schedule claims |
| `setkab.go.id` pages | Speech records | HTML | Yes; RSS TLS unreliable | Yes | Curate official links; no RSS dependency |

## Accuracy boundary

Official sites reliably document speeches after they happen but do not expose a
stable, machine-readable forward calendar. The UI must say **no confirmed
upcoming speech** when the curated dataset has no future confirmed event. It
must never infer or invent one.

Most event records have date-level precision, not verified start times.
Therefore the default impact study reports separately for IHSG and USD/IDR:

- previous trading close → event trading-day close;
- event trading-day close → next trading close.

The 20 May 2026 DPR event additionally contains **reported intraday landmarks**
from contemporaneous journalism, not raw intraday exchange data:

- [Kompas](https://www.kompas.id/artikel/ihsg-volatil-investor-cermati-kepastian-kebijakan-pemerintah)
  reported 6,459 before the speech and 6,215 while it was under way, and linked
  investor concern to the proposed single-export mechanism while also naming
  the pending BI decision and MSCI-related pressure.
- [Yahoo Finance daily history](https://finance.yahoo.com/quote/%5EJKSE/history/)
  separately records the 20 May daily close as 6,318.50. That close belongs to
  the daily series; it is not a Kompas-reported intraday landmark.
- [Bloomberg Technoz](https://www.bloombergtechnoz.com/detail-news/109480/ihsg-jatuh-saat-prabowo-sampaikan-pandangan-ekonomi-di-dpr)
  reported a 1.9% drop during the speech and noted heavier pressure after the
  discussion of export under-invoicing.
- The [official Presidency record](https://presidenri.go.id/siaran-pers/presiden-prabowo-sampaikan-kerangka-ekonomi-makro-dan-pokok-kebijakan-fiskal-rapbn-2027-di-sidang-paripurna-dpr-ri/)
  verifies the event, venue, and KEM–PPKF 2027 agenda.

The rounded Kompas intraday levels may be displayed as attributed context. They
must remain distinct from the two-decimal Yahoo daily close and must not be
described as proof that the speech alone caused the move. The site still does
**not** calculate generic 30-minute
before/after impact. Any future timestamped calculation requires a verified
start time plus a raw intraday market series.

Yahoo Finance IHSG and USD/IDR data is delayed and may be unavailable or revised. IHSG,
stock, and macro headlines remain links to their publishers; this project does not republish article
content. Correlation around a speech date is not evidence of causation.

The GitHub Actions schedule runs once per hour during 09:00–16:00 WIB on
weekdays. Each run merges Yahoo's latest IHSG quote into the daily series, fetches and
merges the latest USD/IDR quote into its one-year daily series, and writes
`data/live.json`; open pages poll that
file every minute (public hosts read the latest commit via raw.githubusercontent.com). GitHub
cron can start late, and Yahoo may delay or revise quotes. Quotes older than about 90
minutes during an open session, or snapshots preserved after a failed fetch, are
labeled **stale**. The UI must distinguish **hourly auto refresh**, **stale
quote**, and **last quote**, and must never claim official exchange real-time.
