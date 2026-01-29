/**
 * Example: Outbound REST API Client
 *
 * A production-ready client for external API integrations
 * with retry logic, error handling, and OAuth support.
 */

var OutboundAPIClient = Class.create();
OutboundAPIClient.prototype = {

    /**
     * Initialize the API client
     * @param {Object} config - Configuration options
     * @param {string} config.baseUrl - Base URL of the API
     * @param {string} config.authType - 'basic', 'oauth', or 'api_key'
     * @param {string} [config.oauthProfile] - OAuth profile name (if using OAuth)
     * @param {number} [config.timeout] - Request timeout in ms (default: 30000)
     * @param {number} [config.maxRetries] - Max retry attempts (default: 3)
     */
    initialize: function(config) {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
        this.authType = config.authType || 'basic';
        this.oauthProfile = config.oauthProfile;
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 3;
        this.logger = new OutboundAPILogger();
    },

    // ==================== Public Methods ====================

    /**
     * GET request
     */
    get: function(endpoint, params) {
        return this._execute('GET', endpoint, params, null);
    },

    /**
     * POST request
     */
    post: function(endpoint, data, params) {
        return this._execute('POST', endpoint, params, data);
    },

    /**
     * PUT request
     */
    put: function(endpoint, data, params) {
        return this._execute('PUT', endpoint, params, data);
    },

    /**
     * PATCH request
     */
    patch: function(endpoint, data, params) {
        return this._execute('PATCH', endpoint, params, data);
    },

    /**
     * DELETE request
     */
    delete: function(endpoint, params) {
        return this._execute('DELETE', endpoint, params, null);
    },

    // ==================== Internal Methods ====================

    _execute: function(method, endpoint, params, data) {
        var url = this._buildUrl(endpoint, params);
        var startTime = new Date().getTime();
        var attempt = 0;
        var lastError = null;

        while (attempt < this.maxRetries) {
            attempt++;

            try {
                var result = this._makeRequest(method, url, data, attempt);

                // Log successful request
                this.logger.logRequest({
                    method: method,
                    url: url,
                    attempt: attempt,
                    statusCode: result.statusCode,
                    duration: new Date().getTime() - startTime,
                    success: result.success
                });

                if (result.success) {
                    return result;
                }

                // Check if we should retry
                if (!this._shouldRetry(result.statusCode, attempt)) {
                    return result;
                }

                lastError = result;
                this._waitBeforeRetry(attempt, result);

            } catch (e) {
                lastError = { error: e.message };

                this.logger.logError({
                    method: method,
                    url: url,
                    attempt: attempt,
                    error: e.message
                });

                if (attempt >= this.maxRetries) {
                    break;
                }

                this._waitBeforeRetry(attempt, null);
            }
        }

        return {
            success: false,
            error: 'Max retries exceeded',
            lastError: lastError,
            attempts: attempt
        };
    },

    _makeRequest: function(method, url, data, attempt) {
        var request = new sn_ws.RESTMessageV2();
        request.setEndpoint(url);
        request.setHttpMethod(method);
        request.setHttpTimeout(this.timeout);

        // Set authentication
        this._applyAuth(request);

        // Set headers
        request.setRequestHeader('Content-Type', 'application/json');
        request.setRequestHeader('Accept', 'application/json');
        request.setRequestHeader('X-Request-ID', gs.generateGUID());

        // Set body
        if (data && ['POST', 'PUT', 'PATCH'].indexOf(method) !== -1) {
            request.setRequestBody(JSON.stringify(data));
        }

        // Execute
        var response = request.execute();
        var statusCode = parseInt(response.getStatusCode(), 10);
        var responseBody = response.getBody();
        var headers = this._parseHeaders(response);

        // Parse response
        var parsedBody = null;
        if (responseBody) {
            try {
                parsedBody = JSON.parse(responseBody);
            } catch (e) {
                parsedBody = responseBody;
            }
        }

        // Determine success
        var success = statusCode >= 200 && statusCode < 300;

        return {
            success: success,
            statusCode: statusCode,
            headers: headers,
            data: success ? parsedBody : null,
            error: success ? null : parsedBody
        };
    },

    _applyAuth: function(request) {
        switch (this.authType) {
            case 'basic':
                var username = gs.getProperty('outbound.api.username');
                var password = gs.getProperty('outbound.api.password');
                request.setBasicAuth(username, password);
                break;

            case 'oauth':
                if (this.oauthProfile) {
                    request.setAuthenticationProfile('oauth2', this.oauthProfile);
                }
                break;

            case 'api_key':
                var apiKey = gs.getProperty('outbound.api.key');
                request.setRequestHeader('Authorization', 'Bearer ' + apiKey);
                break;

            case 'none':
                // No authentication
                break;
        }
    },

    _buildUrl: function(endpoint, params) {
        var url = this.baseUrl + (endpoint.charAt(0) === '/' ? endpoint : '/' + endpoint);

        if (params && Object.keys(params).length > 0) {
            var queryParts = [];
            for (var key in params) {
                if (params.hasOwnProperty(key) && params[key] !== null && params[key] !== undefined) {
                    queryParts.push(
                        encodeURIComponent(key) + '=' + encodeURIComponent(params[key])
                    );
                }
            }
            if (queryParts.length > 0) {
                url += '?' + queryParts.join('&');
            }
        }

        return url;
    },

    _parseHeaders: function(response) {
        var headers = {};
        try {
            var headerString = response.getAllHeaders();
            // Parse headers if available
        } catch (e) {
            // Headers not available
        }
        return headers;
    },

    _shouldRetry: function(statusCode, attempt) {
        if (attempt >= this.maxRetries) {
            return false;
        }

        // Retry on rate limit or server errors
        return statusCode === 429 || statusCode >= 500;
    },

    _waitBeforeRetry: function(attempt, result) {
        var delay;

        // Check for Retry-After header
        if (result && result.headers && result.headers['Retry-After']) {
            delay = parseInt(result.headers['Retry-After'], 10) * 1000;
        } else {
            // Exponential backoff: 1s, 2s, 4s, 8s...
            delay = Math.pow(2, attempt - 1) * 1000;
        }

        // Cap at 30 seconds
        delay = Math.min(delay, 30000);

        // Simple sleep (not ideal for production - consider async patterns)
        var start = new Date().getTime();
        while (new Date().getTime() < start + delay) {
            // Wait
        }
    },

    type: 'OutboundAPIClient'
};


/**
 * Logger for API requests
 */
var OutboundAPILogger = Class.create();
OutboundAPILogger.prototype = {

    initialize: function() {
        this.tableName = 'u_api_integration_log'; // Custom table for logging
    },

    logRequest: function(data) {
        // Log to system log
        var level = data.success ? 'info' : 'warn';
        gs[level]('API Request: ' + data.method + ' ' + data.url +
            ' - Status: ' + data.statusCode +
            ' - Duration: ' + data.duration + 'ms' +
            ' - Attempt: ' + data.attempt);

        // Optionally log to custom table for analytics
        this._writeToTable(data);
    },

    logError: function(data) {
        gs.error('API Error: ' + data.method + ' ' + data.url +
            ' - Error: ' + data.error +
            ' - Attempt: ' + data.attempt);
    },

    _writeToTable: function(data) {
        // Optional: Write to custom logging table for analytics
        // Uncomment if u_api_integration_log table exists
        /*
        var gr = new GlideRecord(this.tableName);
        gr.initialize();
        gr.u_method = data.method;
        gr.u_url = data.url;
        gr.u_status_code = data.statusCode;
        gr.u_duration = data.duration;
        gr.u_success = data.success;
        gr.u_attempt = data.attempt;
        gr.insert();
        */
    },

    type: 'OutboundAPILogger'
};


// ==================== Usage Example ====================

/*
// Initialize client
var client = new OutboundAPIClient({
    baseUrl: 'https://api.example.com/v1',
    authType: 'oauth',
    oauthProfile: 'example_oauth_profile',
    timeout: 30000,
    maxRetries: 3
});

// GET request with query params
var users = client.get('/users', { limit: 10, status: 'active' });
if (users.success) {
    gs.info('Found ' + users.data.length + ' users');
} else {
    gs.error('Failed to fetch users: ' + JSON.stringify(users.error));
}

// POST request
var newUser = client.post('/users', {
    name: 'John Doe',
    email: 'john@example.com'
});
if (newUser.success) {
    gs.info('Created user: ' + newUser.data.id);
}

// PUT request
var updatedUser = client.put('/users/123', {
    name: 'John Updated'
});

// DELETE request
var deleted = client.delete('/users/123');
*/
