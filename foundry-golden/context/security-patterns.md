# ServiceNow Security Patterns

This guide covers security best practices for ServiceNow development, including ACLs, roles, secure coding, and data protection.

---

## Access Control Lists (ACLs)

ACLs are the primary mechanism for controlling data access in ServiceNow.

### ACL Evaluation Order

1. **Table-level ACLs** - Checked first
2. **Field-level ACLs** - Checked for specific field access
3. **Row-level ACLs** - Additional conditions on records

### ACL Operations

| Operation | Description |
|-----------|-------------|
| `read` | View records |
| `write` | Modify records |
| `create` | Create new records |
| `delete` | Delete records |
| `execute` | Execute scripts (processors, etc.) |

### Creating Effective ACLs

```javascript
// Example: ACL script for incident table
// Only allow access to incidents in user's assignment group

var assignmentGroups = gs.getUser().getMyGroups();
var isAssigned = assignmentGroups.indexOf(current.assignment_group.toString()) > -1;
var isAdmin = gs.hasRole('admin');

answer = isAssigned || isAdmin;
```

### ACL Best Practices

1. **Principle of least privilege** - Grant minimum necessary access
2. **Use roles, not users** - Never hardcode user sys_ids
3. **Test thoroughly** - Verify with different user roles
4. **Document purpose** - Add comments explaining the logic
5. **Avoid `*` ACLs** - Be specific about tables and fields

---

## Roles and Groups

### Role Hierarchy

```
admin
├── itil
│   ├── itil_admin
│   └── incident_manager
├── catalog_admin
└── knowledge_admin
```

### Checking Roles in Scripts

```javascript
// Check single role
if (gs.hasRole('itil')) {
    // User has ITIL role
}

// Check multiple roles (any)
if (gs.hasRole('itil,admin')) {
    // User has ITIL OR admin
}

// Check multiple roles (all)
if (gs.hasRole('itil') && gs.hasRole('catalog')) {
    // User has both roles
}

// Get all user roles
var roles = gs.getUser().getRoles();
gs.info('User roles: ' + roles.toString());
```

### Creating Custom Roles

1. Name with application prefix: `x_myapp_admin`
2. Document the role's purpose
3. Include in appropriate role hierarchy
4. Test with dedicated test users

---

## Secure Coding Practices

### Input Validation

```javascript
// Always validate and sanitize input
function processInput(input) {
    // Check for null/undefined
    if (!input) {
        throw new Error('Input is required');
    }

    // Validate type
    if (typeof input !== 'string') {
        throw new Error('Input must be a string');
    }

    // Sanitize - remove potential script injection
    var sanitized = input.replace(/<[^>]*>/g, '');

    // Validate length
    if (sanitized.length > 1000) {
        throw new Error('Input exceeds maximum length');
    }

    return sanitized;
}
```

### Preventing SQL/GlideRecord Injection

```javascript
// BAD - Direct string concatenation
var table = request.getParameter('table');
var gr = new GlideRecord(table); // Dangerous!

// GOOD - Validate against whitelist
var allowedTables = ['incident', 'problem', 'change_request'];
var table = request.getParameter('table');

if (allowedTables.indexOf(table) === -1) {
    throw new Error('Invalid table');
}
var gr = new GlideRecord(table); // Safe
```

### Encoding Output

```javascript
// Encode HTML output to prevent XSS
var userInput = current.description;
var safeOutput = GlideStringUtil.escapeHTML(userInput);

// Encode for JavaScript context
var jsOutput = GlideStringUtil.escapeScript(userInput);

// Encode for URL parameters
var urlOutput = encodeURIComponent(userInput);
```

### Secure Script Includes

```javascript
var SecureHelper = Class.create();
SecureHelper.prototype = {
    initialize: function() {
        // Validate caller has appropriate access
        if (!gs.hasRole('x_myapp_user')) {
            throw new Error('Access denied');
        }
    },

    // Always validate parameters
    getData: function(recordId) {
        if (!this._isValidSysId(recordId)) {
            throw new Error('Invalid record ID');
        }

        var gr = new GlideRecord('my_table');
        if (gr.get(recordId)) {
            return this._sanitizeRecord(gr);
        }
        return null;
    },

    _isValidSysId: function(sysId) {
        return sysId && /^[a-f0-9]{32}$/.test(sysId);
    },

    _sanitizeRecord: function(gr) {
        // Return only safe fields
        return {
            sys_id: gr.getUniqueValue(),
            name: gr.getValue('name'),
            description: GlideStringUtil.escapeHTML(gr.getValue('description'))
        };
    },

    type: 'SecureHelper'
};
```

---

## Data Protection

### Sensitive Data Handling

```javascript
// Never log sensitive data
gs.info('Processing user: ' + user.sys_id); // OK
gs.info('Password: ' + password); // NEVER DO THIS

// Mask sensitive fields in logs
function maskField(value) {
    if (!value || value.length < 4) return '****';
    return value.substring(0, 2) + '****' + value.substring(value.length - 2);
}

gs.info('Processing card: ' + maskField(cardNumber)); // OK
```

### Encryption

```javascript
// Use platform encryption for sensitive data
var encrypter = new GlideEncrypter();

// Encrypt
var encrypted = encrypter.encrypt('sensitive data');

// Decrypt (only when necessary)
var decrypted = encrypter.decrypt(encrypted);
```

### Secure Properties

```javascript
// Store secrets in system properties, not code
var apiKey = gs.getProperty('x_myapp.api_key');

// Use password2 field type for sensitive properties
// These are encrypted at rest
```

---

## API Security

### REST API Authentication

```javascript
// Validate API authentication in Scripted REST API
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

    // Check authentication
    if (!gs.getUser().getID()) {
        response.setStatus(401);
        return { error: 'Authentication required' };
    }

    // Check authorization
    if (!gs.hasRole('x_myapp_api_user')) {
        response.setStatus(403);
        return { error: 'Insufficient permissions' };
    }

    // Process request...

})(request, response);
```

### Rate Limiting

```javascript
// Implement basic rate limiting
var RateLimiter = Class.create();
RateLimiter.prototype = {
    initialize: function(maxRequests, windowSeconds) {
        this.maxRequests = maxRequests || 100;
        this.windowSeconds = windowSeconds || 60;
    },

    isAllowed: function(userId) {
        var key = 'rate_limit_' + userId;
        var gr = new GlideRecord('x_myapp_rate_limit');
        gr.addQuery('user_key', key);
        gr.addQuery('window_start', '>=', gs.secondsAgo(this.windowSeconds));
        gr.query();

        if (gr.getRowCount() >= this.maxRequests) {
            return false;
        }

        // Record this request
        var newGr = new GlideRecord('x_myapp_rate_limit');
        newGr.initialize();
        newGr.user_key = key;
        newGr.window_start = new GlideDateTime();
        newGr.insert();

        return true;
    },

    type: 'RateLimiter'
};
```

---

## Security Checklist

### Before Deployment

- [ ] All inputs validated and sanitized
- [ ] Outputs properly encoded
- [ ] ACLs configured for all tables/fields
- [ ] Roles follow least privilege principle
- [ ] No hardcoded credentials or secrets
- [ ] Sensitive data encrypted
- [ ] API endpoints authenticated/authorized
- [ ] Error messages don't leak sensitive info
- [ ] Logging doesn't include sensitive data
- [ ] Cross-scope access properly controlled

### Code Review Items

- [ ] GlideRecord queries use parameterized values
- [ ] No eval() or similar dynamic code execution
- [ ] User input never directly used in queries
- [ ] Session tokens properly validated
- [ ] CSRF protection on forms
- [ ] File uploads validated and restricted

---

## Common Vulnerabilities

### 1. Insecure Direct Object Reference

```javascript
// BAD - Direct access without authorization check
var gr = new GlideRecord('sensitive_table');
gr.get(request.getParameter('id')); // Anyone can access any record!

// GOOD - Verify access rights
var gr = new GlideRecord('sensitive_table');
gr.addQuery('sys_id', request.getParameter('id'));
gr.query(); // ACLs will filter unauthorized records
```

### 2. Cross-Site Scripting (XSS)

```javascript
// BAD - Unescaped output
document.innerHTML = current.description;

// GOOD - Escaped output
document.textContent = current.description;
// Or use GlideStringUtil.escapeHTML() server-side
```

### 3. Information Disclosure

```javascript
// BAD - Detailed error messages
catch (e) {
    return { error: e.message + '\n' + e.stack }; // Leaks internal details
}

// GOOD - Generic error messages
catch (e) {
    gs.error('Internal error: ' + e.message); // Log details server-side
    return { error: 'An error occurred. Please contact support.' };
}
```

---

## Related Resources

- [Now Assist Platform](./now-assist-platform.md) - Platform security features
- [Troubleshooting Guide](./troubleshooting-guide.md) - Security debugging
- ServiceNow Security Best Practices documentation

---

*Part of the Foundry golden repository*
