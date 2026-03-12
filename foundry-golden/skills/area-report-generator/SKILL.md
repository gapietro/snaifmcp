---
name: area-report-generator
description: "Generate a styled HTML slide presentation for AI Foundry area leader weekly updates from a POC engagements CSV export. Use when someone asks to generate an area report, create a weekly update presentation, build a POC pipeline slide deck, or report on engagements for Financial Services, Healthcare & Life Sciences, Enterprise Verticals, Commercial, TMT & SI, Canada, or US Public Sector."
scope: global
recommended: false
version: 1.0.0
triggers:
  - area report
  - poc engagements
  - weekly update
  - pipeline report
  - slide deck
  - area leader
tags:
  - reporting
  - poc
  - presentations
  - csv
---

# Area Report Generator

Produces a self-contained HTML slide deck from a `POC*.csv` export. The output opens in any browser and requires no additional dependencies.

## Prerequisites

- Python 3.8+
- A `POC*.csv` file in the current working directory (exported from the POC Engagements tracker)

## Quick Start

```bash
# See available areas
python .claude/skills/area-report-generator/scripts/generate_report.py

# Generate a report
python .claude/skills/area-report-generator/scripts/generate_report.py "Financial Services"
```

Output: `area-report-financial-services-YYYY-MM-DD.html` in the current directory.

## Step-by-Step Guide

### Step 1: Confirm your CSV is present

```bash
ls POC*.csv
```

The script uses the file with the highest alphabetical sort order (typically the most recent export).

### Step 2: List available areas

```bash
python .claude/skills/area-report-generator/scripts/generate_report.py
```

### Step 3: Generate the report

```bash
python .claude/skills/area-report-generator/scripts/generate_report.py "Financial Services"
python .claude/skills/area-report-generator/scripts/generate_report.py "Healthcare"
python .claude/skills/area-report-generator/scripts/generate_report.py all
```

The `all` option combines every area into one report.

## Report Structure

The generated deck has 5 slides:

| Slide | Content |
|---|---|
| 1 – Title | Area name, date, hero stats (Building / Scheduled / Pipeline) |
| 2 – This Week's Activity | Cards for all Building + Scheduled engagements |
| 3 – Currently Building | Detailed cards for stage `6. Building` only |
| 4 – Upcoming & Prospects | Cards for Scheduled, Pitched, Demand |
| 5 – Focus Summary | 2 focus cards + 3 totals |

Navigate with `←` `→` arrow keys or on-screen buttons.

## CSV Schema Reference

Required columns (standard POC Engagements export):

| Column | Description |
|---|---|
| `Account Name` | Company name |
| `Requested by` | AE / requestor |
| `Stage` | Pipeline stage |
| `Primary AIF SC` | Primary solution consultant |
| `Major Area` | Business area — used as the filter |

## Installation

```bash
foundry_add type="skill" name="area-report-generator" global=true
```
