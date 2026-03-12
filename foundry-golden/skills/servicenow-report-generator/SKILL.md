---
name: servicenow-report
description: Generate HTML reports or interactive showcases from ServiceNow update set XMLs
scope: global
recommended: false
version: 1.0.0
triggers:
  - update set
  - xml report
  - servicenow showcase
  - report generator
  - update set xml
tags:
  - servicenow
  - reporting
  - html
  - update-set
---

# ServiceNow Report Generator

Generates technical reports or interactive showcases from ServiceNow update set XML files.

## Usage

- `/servicenow-report report <xml_file>` - Generate technical report
- `/servicenow-report showcase <xml_file> [xml_file2...]` - Generate interactive showcase
- `/servicenow-report update <existing_report>` - Update existing report

## Mode Detection

Determine mode based on context:
- Keywords "report", "documentation" → report mode
- Keywords "showcase", "presentation", "walkthrough" → showcase mode
- If unclear, ask user which mode

## Workflow

### 1. File Validation

- Verify XML files exist and contain `<sys_remote_update_set>` root element
- Count `<sys_update_xml>` records for summary

### 2. Version Management

- Find all existing versions in directory (pattern: `*Report_v*.html`)
- Extract numeric versions (v1, v2, v3...)
- Increment to next whole number
- Confirm with user before generating

### 3. XML Parsing

**Object Type Mapping:**

| Type | Category |
|------|----------|
| `sn_aia_version`, `sn_aia_usecase` | AI Objects |
| `sn_aia_skill` | Now Assist Skills |
| `sys_hub_flow` | Flow Designer |
| `sys_hub_action_type_base` | Actions |
| `sys_script_include`, `sys_script` | Scripts |
| `sys_ui_page` | UI Components |

### 4. Report Generation (Single HTML)

**Sections:**
1. Application Overview - app name, scope, description, counts
2. Solution Architecture - high-level description, integration points
3. Agentic Use Case (if present) - use case details, base plan, instructions
4. AI Agents (if present) - configurations, prompts, tools
5. Flow Designer Objects - flows, subflows, actions
6. Key Patterns & Innovation - novel approaches, best practices
7. Business Impact - value proposition, metrics
8. Technical Implementation - scripts, configuration, dependencies

**Write Output:** `[AppName]_Report_v[N].html`

### 5. Showcase Generation (3 Files)

For multiple XMLs — creates a landing page with cards for all applications.

**Files generated:**
1. `[Name]_Showcase.html` - Main HTML structure with landing page
2. `showcase-data.js` - Pure data (appData array)
3. `showcase-app.js` - Event handlers and section builders

**CRITICAL: 3-File Architecture**
- Separate data from logic from presentation
- Use DOM construction, not string templates
- Avoid nested template literals

### 6. Update Support

When user provides an existing report:
- Detect current version
- Options: Add section, Remove section, Reorganize, Update content, In-place edit, New version

## Error Handling

- Invalid XML → verify root element, provide clear error
- Missing files → suggest similar filenames, list XML files in directory
- Version conflicts → warn before overwriting, suggest next available version

## Styling

- Navy (#032D42) and Green (#63DF4E) ServiceNow color scheme
- Responsive design

## Installation

```bash
foundry_add type="skill" name="servicenow-report-generator" global=true
```
