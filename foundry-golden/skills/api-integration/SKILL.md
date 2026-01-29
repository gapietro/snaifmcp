# Skill: API Integration

> Helps you build ServiceNow REST API integrations for Now Assist POCs.

---

## Purpose

This skill guides you through creating robust API integrations with the ServiceNow platform, including authentication, CRUD operations, and error handling.

## When to Use

Use this skill when you need to:
- Connect to ServiceNow REST APIs
- Perform CRUD operations on tables
- Handle authentication (Basic, OAuth)
- Implement error handling and retries
- Build integration scripts for external systems

## Instructions

When the user asks to create an API integration, follow these steps:

### Step 1: Identify the Integration Type

Ask the user:
1. **Direction**: Inbound (external → ServiceNow) or Outbound (ServiceNow → external)?
2. **Data**: What tables/records will be accessed?
3. **Operations**: Read, Create, Update, Delete, or combination?
4. **Authentication**: Basic Auth, OAuth 2.0, or API Key?
5. **Trigger**: On-demand, scheduled, or event-driven?

### Step 2: Design the Integration

#### For Inbound (REST API to ServiceNow)

Recommend Scripted REST API:
```
API Structure:
  /api/{namespace}/{api_name}/{version}
    ├── GET    /{resource}          - List resources
    ├── GET    /{resource}/{id}     - Get single resource
    ├── POST   /{resource}          - Create resource
    ├── PUT    /{resource}/{id}     - Update resource
    └── DELETE /{resource}/{id}     - Delete resource
```

#### For Outbound (ServiceNow to External)

Recommend REST Message + Business Rule/Flow:
```
Components:
  ├── REST Message        - Defines endpoint and methods
  ├── REST Message Method - HTTP method configuration
  └── Trigger             - Business Rule, Flow, or Scheduled Job
```

### Step 3: Generate Code

#### Inbound: Scripted REST API

```javascript
(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {

    var method = request.getHeader('X-HTTP-Method-Override') || request.getMethod();
    var pathParams = request.pathParams;
    var queryParams = request.queryParams;
    var body = request.body ? request.body.data : null;

    try {
        switch (method) {
            case 'GET':
                if (pathParams.id) {
                    return getRecord(pathParams.id, response);
                }
                return listRecords(queryParams, response);

            case 'POST':
                return createRecord(body, response);

            case 'PUT':
                return updateRecord(pathParams.id, body, response);

            case 'DELETE':
                return deleteRecord(pathParams.id, response);

            default:
                response.setStatus(405);
                return { error: 'Method not allowed' };
        }
    } catch (e) {
        response.setStatus(500);
        return { error: 'Internal server error', message: e.message };
    }

    function getRecord(id, response) {
        var gr = new GlideRecord('{table_name}');
        if (!gr.get(id)) {
            response.setStatus(404);
            return { error: 'Record not found' };
        }
        return formatRecord(gr);
    }

    function listRecords(params, response) {
        var gr = new GlideRecord('{table_name}');

        // Apply filters from query params
        if (params.query) {
            gr.addEncodedQuery(params.query);
        }

        // Pagination
        var limit = parseInt(params.limit) || 100;
        var offset = parseInt(params.offset) || 0;
        gr.setLimit(limit);
        gr.chooseWindow(offset, offset + limit);

        gr.query();

        var records = [];
        while (gr.next()) {
            records.push(formatRecord(gr));
        }

        return {
            count: records.length,
            offset: offset,
            limit: limit,
            records: records
        };
    }

    function createRecord(data, response) {
        var gr = new GlideRecord('{table_name}');
        gr.initialize();

        for (var field in data) {
            if (gr.isValidField(field)) {
                gr.setValue(field, data[field]);
            }
        }

        var sys_id = gr.insert();
        if (!sys_id) {
            response.setStatus(400);
            return { error: 'Failed to create record' };
        }

        response.setStatus(201);
        gr.get(sys_id);
        return formatRecord(gr);
    }

    function updateRecord(id, data, response) {
        var gr = new GlideRecord('{table_name}');
        if (!gr.get(id)) {
            response.setStatus(404);
            return { error: 'Record not found' };
        }

        for (var field in data) {
            if (gr.isValidField(field)) {
                gr.setValue(field, data[field]);
            }
        }

        gr.update();
        return formatRecord(gr);
    }

    function deleteRecord(id, response) {
        var gr = new GlideRecord('{table_name}');
        if (!gr.get(id)) {
            response.setStatus(404);
            return { error: 'Record not found' };
        }

        gr.deleteRecord();
        response.setStatus(204);
        return null;
    }

    function formatRecord(gr) {
        return {
            sys_id: gr.sys_id.toString(),
            // Add other fields as needed
        };
    }

})(request, response);
```

#### Outbound: REST Message Client

```javascript
/**
 * REST API Client for external service integration
 */
var ExternalAPIClient = Class.create();
ExternalAPIClient.prototype = {

    initialize: function(config) {
        this.baseUrl = config.baseUrl;
        this.authType = config.authType || 'basic';
        this.timeout = config.timeout || 30000;
        this.retryAttempts = config.retryAttempts || 3;
    },

    /**
     * Make a GET request
     */
    get: function(endpoint, params) {
        return this._request('GET', endpoint, params, null);
    },

    /**
     * Make a POST request
     */
    post: function(endpoint, data) {
        return this._request('POST', endpoint, null, data);
    },

    /**
     * Make a PUT request
     */
    put: function(endpoint, data) {
        return this._request('PUT', endpoint, null, data);
    },

    /**
     * Make a DELETE request
     */
    delete: function(endpoint) {
        return this._request('DELETE', endpoint, null, null);
    },

    /**
     * Internal request handler with retry logic
     */
    _request: function(method, endpoint, params, data) {
        var url = this.baseUrl + endpoint;

        if (params) {
            url += '?' + this._encodeParams(params);
        }

        var attempt = 0;
        var lastError;

        while (attempt < this.retryAttempts) {
            try {
                var request = new sn_ws.RESTMessageV2();
                request.setEndpoint(url);
                request.setHttpMethod(method);
                request.setHttpTimeout(this.timeout);

                // Set authentication
                this._setAuthentication(request);

                // Set headers
                request.setRequestHeader('Content-Type', 'application/json');
                request.setRequestHeader('Accept', 'application/json');

                // Set body for POST/PUT
                if (data && (method === 'POST' || method === 'PUT')) {
                    request.setRequestBody(JSON.stringify(data));
                }

                var response = request.execute();
                var statusCode = response.getStatusCode();
                var body = response.getBody();

                // Check for success
                if (statusCode >= 200 && statusCode < 300) {
                    return {
                        success: true,
                        statusCode: statusCode,
                        data: body ? JSON.parse(body) : null
                    };
                }

                // Check for retryable errors
                if (this._isRetryable(statusCode) && attempt < this.retryAttempts - 1) {
                    attempt++;
                    this._sleep(Math.pow(2, attempt) * 1000);
                    continue;
                }

                // Non-retryable error
                return {
                    success: false,
                    statusCode: statusCode,
                    error: body ? JSON.parse(body) : { message: 'Request failed' }
                };

            } catch (e) {
                lastError = e;
                attempt++;

                if (attempt < this.retryAttempts) {
                    this._sleep(Math.pow(2, attempt) * 1000);
                }
            }
        }

        return {
            success: false,
            error: { message: 'Max retries exceeded', details: lastError ? lastError.message : '' }
        };
    },

    _setAuthentication: function(request) {
        switch (this.authType) {
            case 'basic':
                request.setBasicAuth(
                    gs.getProperty('integration.api.username'),
                    gs.getProperty('integration.api.password')
                );
                break;

            case 'oauth':
                // Use OAuth profile
                request.setAuthenticationProfile('oauth2', 'oauth_profile_name');
                break;

            case 'api_key':
                request.setRequestHeader('X-API-Key',
                    gs.getProperty('integration.api.key'));
                break;
        }
    },

    _isRetryable: function(statusCode) {
        return statusCode === 429 || statusCode >= 500;
    },

    _encodeParams: function(params) {
        var parts = [];
        for (var key in params) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
        return parts.join('&');
    },

    _sleep: function(ms) {
        var start = new Date().getTime();
        while (new Date().getTime() < start + ms) {
            // Wait
        }
    },

    type: 'ExternalAPIClient'
};
```

### Step 4: Configure Authentication

#### Basic Authentication
```javascript
// Store credentials securely
gs.setProperty('integration.api.username', 'api_user', 'Integration API Username');
gs.setProperty('integration.api.password', 'encrypted_password', 'Integration API Password');
```

#### OAuth 2.0
1. Navigate to System OAuth → Application Registry
2. Create new OAuth API endpoint for client
3. Configure:
   - Client ID
   - Client Secret
   - Authorization/Token URLs
   - Grant Type

#### API Key
```javascript
// Store in system property (encrypted)
gs.setProperty('integration.api.key', 'your_api_key', 'External API Key');
```

### Step 5: Add Error Handling

```javascript
var ErrorHandler = {

    handle: function(error, context) {
        // Log error
        gs.error('API Integration Error: ' + JSON.stringify({
            error: error.message || error,
            context: context
        }));

        // Determine error type and response
        if (error.statusCode === 401) {
            return this.handleAuthError(error, context);
        } else if (error.statusCode === 429) {
            return this.handleRateLimitError(error, context);
        } else if (error.statusCode >= 500) {
            return this.handleServerError(error, context);
        } else {
            return this.handleGenericError(error, context);
        }
    },

    handleAuthError: function(error, context) {
        // Attempt token refresh for OAuth
        // Or alert admin for credential issues
        return { retry: false, action: 'alert_admin' };
    },

    handleRateLimitError: function(error, context) {
        // Extract retry-after header if available
        var retryAfter = error.headers ? error.headers['Retry-After'] : 60;
        return { retry: true, delay: retryAfter * 1000 };
    },

    handleServerError: function(error, context) {
        // Retry with exponential backoff
        return { retry: true, delay: context.attempt * 2000 };
    },

    handleGenericError: function(error, context) {
        return { retry: false, action: 'log_and_continue' };
    }
};
```

### Step 6: Test the Integration

Provide test script:
```javascript
// Test outbound integration
var client = new ExternalAPIClient({
    baseUrl: 'https://api.example.com/v1',
    authType: 'basic'
});

// Test GET
var getResult = client.get('/resources', { limit: 10 });
gs.info('GET Result: ' + JSON.stringify(getResult));

// Test POST
var postResult = client.post('/resources', { name: 'Test', value: 123 });
gs.info('POST Result: ' + JSON.stringify(postResult));
```

## Examples

See the `examples/` directory for:
- `inbound-api-example.js` - Complete Scripted REST API
- `outbound-client-example.js` - External service client with retry logic

## Best Practices

1. **Security**
   - Never hardcode credentials
   - Use system properties for configuration
   - Implement proper authentication
   - Validate all inputs

2. **Reliability**
   - Implement retry logic with exponential backoff
   - Handle rate limiting gracefully
   - Set appropriate timeouts
   - Log all API interactions

3. **Performance**
   - Use pagination for large datasets
   - Cache responses when appropriate
   - Minimize payload sizes
   - Use async patterns for long operations

4. **Maintainability**
   - Document all endpoints
   - Version your APIs
   - Use consistent error formats
   - Write comprehensive tests
