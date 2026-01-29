# Project: {{PROJECT_NAME}}

> Bootstrapped with Foundry - AI Foundry's project accelerator

---

## AI Foundry Context

This project was initialized with pre-loaded resources for Now Assist POC development.

### Available Resources

| Location | Contents |
|----------|----------|
| `.claude/context/` | Platform context and patterns |
| `.claude/skills/` | Reusable Claude Code skills |

### Context Files
- **now-assist-platform.md** - Now Assist architecture, APIs, configuration
- **genai-framework.md** - GenAI Controller, skill development patterns
- **agentic-patterns.md** - Agentic framework, tool definitions, orchestration

### Skills
- **now-assist-skill-builder** - Guide for creating custom Now Assist skills
- **api-integration** - ServiceNow REST API integration patterns

---

## SPARC Methodology

This project follows SPARC: **S**pecification → **P**seudocode → **A**rchitecture → **R**efinement → **C**ompletion

### Current Phase: Specification

#### Problem Statement
<!-- What problem are we solving? Who is affected? What's the impact? -->


#### Success Criteria
<!-- How do we know when we're done? What metrics matter? -->
- [ ]
- [ ]
- [ ]

#### Stakeholders
<!-- Who needs to be involved or informed? -->


#### Constraints
<!-- Technical, timeline, resource, or policy constraints -->


---

## Technical Notes

### APIs & Integrations
<!-- Document API contracts, authentication, endpoints -->


### Data Model
<!-- Key tables, fields, relationships -->


### Architecture Decisions
<!-- Record important decisions and rationale -->

| Decision | Rationale | Date |
|----------|-----------|------|
| | | |

---

## Progress Log

<!-- Track progress through SPARC phases -->

### Specification Phase
- [ ] Problem statement defined
- [ ] Success criteria documented
- [ ] Stakeholders identified
- [ ] Constraints documented

### Pseudocode Phase
- [ ] High-level logic outlined
- [ ] Edge cases identified
- [ ] Data flow documented

### Architecture Phase
- [ ] Components designed
- [ ] Integrations mapped
- [ ] Security reviewed

### Refinement Phase
- [ ] Code implemented
- [ ] Tests written
- [ ] Code reviewed

### Completion Phase
- [ ] Deployed to test
- [ ] User acceptance
- [ ] Documentation complete
- [ ] Deployed to production

---

## Conventions

### Code Style
- **Language:** TypeScript/JavaScript for scripts, ServiceNow conventions for platform code
- **Naming:** camelCase for variables/functions, PascalCase for classes
- **Comments:** JSDoc for public methods, inline for complex logic

### ServiceNow Patterns
- Use Script Includes for reusable logic
- Prefer Flow Designer over Business Rules for complex workflows
- Use GlideRecord best practices (always check for existence, use encoded queries)

### Git Workflow
- Branch naming: `feature/`, `fix/`, `refactor/`
- Commit messages: Conventional Commits format
- PR required for main branch

---

## Quick Reference

### Useful Commands
```bash
# Run tests (if applicable)
npm test

# Lint code
npm run lint
```

### ServiceNow Instance
- **Instance URL:**
- **Scope:**
- **Update Set:**

### Team Contacts
- **Tech Lead:**
- **Product Owner:**
- **ServiceNow Admin:**
