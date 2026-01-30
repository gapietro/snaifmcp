# {{PROJECT_NAME}}

## Project Overview

Add your project description here.

---

## Methodology

This project follows standard ServiceNow development practices.

### Development Workflow

1. **Understand** - Review requirements and existing functionality
2. **Design** - Plan the implementation approach
3. **Implement** - Write code following best practices
4. **Test** - Verify functionality works as expected
5. **Document** - Update relevant documentation

---

## Context

This project includes core ServiceNow context files:

- **Now Assist Platform** - Platform architecture and APIs
- **GenAI Framework** - Skill development patterns
- **Agentic Patterns** - AI Agent framework

Review the `.claude/context/` directory for detailed documentation.

---

## Guidelines

### Code Standards

- Follow ServiceNow scripting best practices
- Use descriptive variable names
- Add comments for complex logic
- Handle errors appropriately

### Security

- Validate all inputs
- Follow principle of least privilege
- Never hardcode credentials
- Use ACLs for data protection

### Testing

- Test with multiple user roles
- Verify edge cases
- Check error handling

---

## Adding Resources

Use Foundry tools to add skills as needed:

```
# List available skills
foundry_list type="skills"

# Add a skill
foundry_add type="skill" name="api-integration"
foundry_add type="skill" name="servicenow-troubleshooting"
```

---

## Project Structure

```
{{PROJECT_NAME}}/
├── CLAUDE.md           # This file
├── .gitignore          # Git ignore rules
└── .claude/
    └── context/        # Domain knowledge
        ├── now-assist-platform.md
        ├── genai-framework.md
        └── agentic-patterns.md
```

---

## Notes

- Created with Foundry standard template
- Skills can be added as needed
- Update this file with project-specific information
