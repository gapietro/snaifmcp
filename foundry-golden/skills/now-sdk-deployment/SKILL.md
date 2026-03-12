---
name: now-sdk-deployment
description: Use when deploying ServiceNow applications with now-sdk, checking authentication status, or when user mentions deployment to ServiceNow instance
scope: global
recommended: true
version: 1.0.0
triggers:
  - deploy
  - deployment
  - now-sdk install
  - now-sdk auth
  - servicenow instance
  - install to servicenow
tags:
  - servicenow
  - deployment
  - now-sdk
---

# ServiceNow SDK Authentication and Deployment

## Overview

Deploying ServiceNow applications requires a strict workflow: verify authentication, confirm instance with user, then deploy. This skill prevents common mistakes like deploying to the wrong instance or deploying without user confirmation.

## When to Use

Use this skill when:
- User asks to deploy a ServiceNow application
- User mentions "deploy to ServiceNow"
- After merging code that needs deployment
- User asks about authentication status
- Switching between ServiceNow instances

Do NOT use for:
- Building applications (without deployment)
- Running tests
- Development tasks unrelated to deployment

## The Golden Rules

1. **NEVER deploy without confirming instance with user first**
2. **ALWAYS check authentication before attempting deployment**
3. **ALWAYS ask user before deploying** (don't assume)
4. **DEFAULTS CAN CHANGE** - Never assume the default is still what it was last time

## Quick Deployment Checklist (TL;DR)

**Before EVERY deployment:**

```
□ Check: now-sdk auth --list
□ Verify default instance is correct (defaults can change!)
□ Show instance name to user
□ Get explicit approval
□ Deploy: now-sdk install (or --auth <alias>)
```

**Critical:** The default instance can change between sessions. Always check `--list` before deploying, even if you "just checked it yesterday."

## The Deployment Workflow

### Step 1: Check authentication

```bash
now-sdk auth --list
```

Output shows all aliases. The `*` prefix marks the default.

### Step 2: Show instance to user

```markdown
I see the default instance is **dev-instance**. Ready to deploy?
```

**Wait for explicit confirmation before proceeding.**

### Step 3: Deploy

```bash
# Deploy to default instance
now-sdk install

# Or deploy to specific instance (override default)
now-sdk install -a prod
```

## Quick Reference

| Step | Command | Purpose |
|------|---------|---------|
| List credentials | `now-sdk auth --list` | See all auth aliases and default |
| Add credentials | `now-sdk auth --add <instance> --type basic --alias <name>` | Store new credentials |
| Set default | `now-sdk auth --use <alias>` | Change default instance |
| Deploy | `now-sdk install` | Deploy to default instance |
| Deploy to specific | `now-sdk install -a <alias>` | Override default |

## Instance Name Format

**CRITICAL:** When adding authentication, use only the instance name, not the full URL.

```bash
# Correct
now-sdk auth --add gpinst01 --type basic --alias prod

# Wrong - includes domain (SDK appends .service-now.com automatically)
now-sdk auth --add gpinst01.service-now.com --type basic --alias prod
```

## Common Mistakes

| Mistake | Correct Approach |
|---------|------------------|
| Deploy without checking auth | Check `now-sdk auth --list` first |
| Assume instance from context | Always confirm with user |
| Deploy without asking | Ask user before every deployment |
| Skip auth status check | Verify aliases exist before attempting |

## Red Flags — STOP and Verify

These thoughts mean you need to check authentication:

- "The default is still [instance] from last time" ⚠️ DANGER
- "We deployed to [instance] yesterday, so that's still the default" ⚠️ DANGER
- "I checked the default earlier this session" ⚠️ Still check again!

## Installation

```bash
foundry_add type="skill" name="now-sdk-deployment" global=true
```
