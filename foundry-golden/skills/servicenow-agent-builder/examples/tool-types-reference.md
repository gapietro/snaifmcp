# Tool Types Reference — ServiceNow Zurich

> Configuration examples for all 13 AI Agent tool types available in ServiceNow Zurich.

---

## 1. Script Tool

Custom editable script with full control.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Script

```javascript
// Example: Get incident details
(function(inputs) {
    var outputs = {};
    try {
        var gr = new GlideRecordSecure('incident');
        gr.addUserEncodedQuery();
        gr.addQuery('number', String(inputs.incident_number || ''));
        gr.setLimit(1);
        gr.query();

        if (gr.next()) {
            outputs.record = {
                sys_id: gr.getValue('sys_id'),
                number: gr.getValue('number'),
                short_description: gr.getValue('short_description'),
                state: gr.getDisplayValue('state'),
                priority: gr.getDisplayValue('priority'),
                assigned_to: gr.getDisplayValue('assigned_to')
            };
            outputs.status = 'success';
        } else {
            outputs.status = 'not_found';
            outputs.error = 'Incident not found: ' + inputs.incident_number;
        }
    } catch (e) {
        outputs.error = String(e.message || e);
        outputs.status = 'error';
    }
    return outputs;
})(inputs);
```

**Input Schema:**
```json
[{"name": "incident_number", "type": "string", "mandatory": true}]
```

**Rules:**
- Use `GlideRecordSecure` (not `GlideRecord`)
- Call `addUserEncodedQuery()` for ACL enforcement
- No `gs.*` APIs (cause silent hangs)
- No `GlideDateTime` (use `new Date()` instead)
- No CamelCase for `internal_name`
- Wrap in IIFE: `(function(inputs) { ... })(inputs);`

---

## 2. Record Operation Tool

Standard CRUD on any ServiceNow table — no scripting needed.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Record operation

**Configuration:**
| Field | Value |
|-------|-------|
| Table | `incident` |
| Operation | Read / Create / Update / Delete |
| Fields | Select which fields are accessible |
| Filter | Optional conditions to restrict scope |

**Best for:** Simple get/update/create operations where custom logic isn't needed.

---

## 3. Flow Action Tool

Invoke IntegrationHub spoke actions.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Flow action

**Configuration:**
| Field | Value |
|-------|-------|
| Spoke | Select IntegrationHub spoke |
| Action | Select specific action from spoke |
| Input mapping | Map agent inputs to action inputs |

**Best for:** External integrations (Slack notifications, Jira tickets, email, REST calls).

---

## 4. Subflow Tool

Execute a Flow Designer subflow.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Sub flow

**Configuration:**
| Field | Value |
|-------|-------|
| Subflow | Select existing subflow |
| Input mapping | Map agent inputs to subflow inputs |

**Best for:** Complex multi-step automations already built in Flow Designer.

---

## 5. Search Retrieval Tool

Full-text search across configured data sources.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Search retrieval

**Configuration:**
| Field | Value |
|-------|-------|
| Search profile | Select or create search profile |
| Max results | Number of results to return |
| Sources | Knowledge bases, tables, etc. |

**Tip:** For voice agents, create a dedicated search profile with narrow scope to minimize latency.

---

## 6. Knowledge Graph Tool

Retrieve information from knowledge graphs.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Knowledge Graph

**Best for:** Structured knowledge retrieval, FAQ-style responses, topic-based search.

---

## 7. Now Assist Skill Tool

Invoke an existing Now Assist skill as a tool.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Now Assist skill

**Configuration:**
| Field | Value |
|-------|-------|
| Skill | Select registered Now Assist skill |
| Input mapping | Map agent inputs to skill inputs |

**Best for:** Reusing existing skills (summarization, classification) within agent workflows.

---

## 8. Catalog Item Tool

Trigger service catalog items.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Catalog item

**Best for:** Ordering hardware, requesting software, submitting service requests.

---

## 9. Conversational Topic Tool

Link to Virtual Agent conversation topics.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Conversational topic

**Best for:** Structured conversations with guided data collection.

---

## 10. Desktop Action Tool

Perform actions in the workspace UI.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Desktop action

**Best for:** Workspace-specific operations, form actions, navigation.

---

## 11. File Upload Tool

Process uploaded files (PDF, DOCX, TXT).

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > File upload

**Best for:** Document analysis, attachment processing, voice agent file intake.

---

## 12. Web Search Tool

Search the internet for real-time information.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > Web search

**Warning: NOT supported by Azure OpenAI.** Only available with providers that support web search.

**Best for:** Real-time information lookup, current events, external documentation.

---

## 13. MCP Server Tool

Consume tools from external MCP servers.

**Navigation:** AI Agent Studio > AI agents > [agent] > Add tools > MCP server tool

**Prerequisites:**
- `sn_aia.enable_mcp_tool` = `true`
- MCP server configured in: AI Agent Studio > Settings > Manage MCP Servers

**Configuration:**
| Field | Description |
|-------|-------------|
| MCP Server | Select configured server |
| Tool | Select from discovered tools |
| Execution Mode | Supervised or Autonomous |
| Output transformation | How to transform raw output |

**Best for:** Integrating external AI tools, third-party services via MCP protocol.

---

## Tool Type Selection Guide

| Need | Recommended Tool Type |
|------|----------------------|
| Custom database queries | Script |
| Simple CRUD operations | Record operation |
| External system integration | Flow action |
| Complex automation | Subflow |
| Knowledge base search | Search retrieval or Knowledge graph |
| Reuse existing AI skill | Now Assist skill |
| Order/request something | Catalog item |
| Guided conversation | Conversational topic |
| Upload/process files | File upload |
| Live internet search | Web search |
| External AI tools | MCP server tool |

---

*All tool types validated against ServiceNow Zurich documentation.*
