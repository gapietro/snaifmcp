---
name: now-fluent-generator
description: Generate ServiceNow Fluent DSL code for tables, fields, and components using correct SDK schemas and patterns
scope: global
recommended: false
version: 1.0.0
triggers:
  - fluent dsl
  - .now.ts
  - servicenow table
  - now.id
  - sdk schema
  - fluent generator
tags:
  - servicenow
  - fluent
  - now-sdk
  - code-generation
---

# ServiceNow Fluent DSL Code Generator

## Overview

This skill helps Claude Code generate correct ServiceNow Fluent DSL code by following SDK schemas and best practices. It ensures generated code uses proper field types, follows naming conventions, and includes necessary imports.

## When to Use

Use this skill when:
- Creating new ServiceNow table definitions (.now.ts files)
- Adding fields to existing tables
- Creating Script Includes, UI Pages, or other components
- User asks to "generate Fluent DSL code"
- Working with ServiceNow SDK in a scoped application

Do NOT use for:
- Non-ServiceNow projects
- Reading existing Fluent DSL code (use standard tools)
- Deployment tasks (use now-sdk-deployment skill)

## The Golden Rules

1. **ALWAYS check SDK schemas first** - Read schema from `node_modules/@servicenow/sdk-core/dist/fluent/tables/`
2. **Use Now.ID for sys_id generation** - Never manually create sys_ids
3. **Follow naming conventions** - Table names: snake_case, Field names: snake_case
4. **Import correct types** - Import from `@servicenow/sdk-core/fluent`
5. **Validate field types** - Use exact field types from SDK schemas

## Quick Reference

### Table Definition Pattern

```typescript
import { Now } from '@servicenow/sdk-core';

declare const my_table = Now.table({
  $id: Now.ID['my_table'],
  name: 'x_scope_my_table',
  label: 'My Table',
  extends: 'sys_metadata',
  columns: {
    field_name: {
      type: 'string',
      label: 'Field Label',
      maxLength: 255,
      mandatory: false,
    },
  },
});

export default my_table;
```

### Common Field Types

| Type | When to Use |
|------|-------------|
| `string` | Short text (up to maxLength) |
| `text` | Long text (no length limit) |
| `boolean` | True/false values |
| `integer` | Whole numbers |
| `reference` | Link to another table |
| `glide_date_time` | Date and time |
| `choice` | Predefined options |

## Critical Patterns

### 1. Always Check SDK Schemas First

```bash
# Find the schema file
ls node_modules/@servicenow/sdk-core/dist/fluent/tables/ | grep <table_name>

# Read the schema
cat node_modules/@servicenow/sdk-core/dist/fluent/tables/<table_name>.now.d.ts
```

### 2. Use Now.ID for sys_id Generation

```typescript
// Correct
$id: Now.ID['my_table'],

// Wrong - DO NOT manually create sys_ids
$id: '7e92c6d72f8e7254864ea72cbfa4e389',
```

### 3. Cross-Instance References

When referencing records across instances, use the actual sys_id as the key name:

```typescript
// Correct — same sys_id on every instance
$id: Now.ID['10da59472b5fba5017a6ffbeee91bf09']
// In child: capability: '10da59472b5fba5017a6ffbeee91bf09'

// Wrong — generates a different UUID per instance
$id: Now.ID['my_capability']
// In child: capability: Now.ID['my_capability']  ← passes literal string
```

## Validation Checklist

- [ ] Read the SDK schema for the table type
- [ ] Verify field types are valid per schema
- [ ] Use `Now.ID['key']` for $id field
- [ ] Follow snake_case naming for fields
- [ ] Include proper imports
- [ ] Set appropriate maxLength for strings

## Installation

```bash
foundry_add type="skill" name="now-fluent-generator" global=true
```
