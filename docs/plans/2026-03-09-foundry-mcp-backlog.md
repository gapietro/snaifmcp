# Foundry MCP — Prioritized Backlog
> Last updated: 2026-03-09

---

## Tier 1 — Quick wins & critical UX (start here)

| Priority | Issue | Title | Effort |
|----------|-------|-------|--------|
| 1 | [#136](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/136) | `foundry_init` bootstraps current directory, not a new subdirectory | S |
| 2 | [#137](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/137) | Rename templates → `foundry-poc` / `foundry-minimal`, drop `standard` | S |
| 3 | [#130](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/130) | Expand `.gitignore` template in `foundry_init` | XS |
| 4 | [#138](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/138) | Add standardized POC engagement folder structure to both templates (additive) | S |

### Notes
- #136 is the highest friction point for users — they're already in their project dir when they run `foundry_init`
- #137 and #130 are 1-file changes; batch them into a single PR if desired
- #138 is purely additive — no existing init behavior changes, just creates the engagement folders alongside

---

## Tier 2 — Core skill management architecture

| Priority | Issue | Title | Effort | Notes |
|----------|-------|-------|--------|-------|
| 5 | [#116](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/116) | Global skill install via existing `foundry_*` tools (from foundry-golden) | L | Supersedes #107; foundational for Tier 3 |
| 6 | [#109](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/109) | `skills-state.ts` — installed.json tracking for CC skills | S | Can be folded into #116 PR or done first as a prerequisite |

---

## Tier 3 — Skill intelligence (depends on Tier 2)

| Priority | Issue | Title | Effort |
|----------|-------|-------|--------|
| 7 | [#110](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/110) | Startup warning for missing recommended skills | S |
| 8 | [#111](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/111) | `foundry_check_context` — trigger-based skill suggestion tool | M |
| 9 | [#113](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/113) | Config flags: `auto_install_recommended`, `auto_use_on_trigger`, `notify_not_installed` | S |

---

## Tier 4 — UX polish

| Priority | Issue | Title | Effort |
|----------|-------|-------|--------|
| 10 | [#115](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/115) | MCP Prompts — expose installed skills as slash commands | M |
| 11 | [#114](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/114) | CLAUDE.md integration — auto call `foundry_check_context` at task start | XS–M |
| 12 | [#126](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/126) | `servicenow_aia_get` should suggest `servicenow_aia_usecase_get` when name matches a use case | S |

---

## Parking Lot (low alignment / deferred)

| Issue | Title | Notes |
|-------|-------|-------|
| [#129](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/129) | Auto-convert pptx/docx/xlsx to PDF before reading | Low alignment to core ServiceNow/AI Foundry mission; adds heavy external deps |
| [#112](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/112) | Dynamic tool-based skills (`has_tools: true`) | Dale flagged as lowest priority; defer until Tiers 1–3 complete |
| [#107](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/107) | `foundry_cc_skill_*` parallel tool suite | Superseded by #116's cleaner approach; close when #116 merges |

---

## Bottom

| Issue | Title |
|-------|-------|
| [#77](https://github.com/Now-AI-Foundry/tool-foundry-mcp/issues/77) | Enhancement: Cannot create complete Agentic Workflow end-to-end via MCP |

---

## Current Version
`2026.03.0601` — repo: `Now-AI-Foundry/tool-foundry-mcp`

## Branch Naming Reminder
- `feature/` — new functionality
- `fix/` — bug fixes
- `chore/` — config/maintenance
- All work via branch + PR, never direct to main
- Version bump commit format: `chore: bump version to YYYY.MM.DDXX (#PR_NUMBER)`
