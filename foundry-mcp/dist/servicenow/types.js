/**
 * ServiceNow Integration Types
 */
// Error types
export var ServiceNowErrorType;
(function (ServiceNowErrorType) {
    // Connection errors
    ServiceNowErrorType["CONNECTION_FAILED"] = "connection_failed";
    ServiceNowErrorType["AUTHENTICATION_FAILED"] = "authentication_failed";
    ServiceNowErrorType["TOKEN_EXPIRED"] = "token_expired";
    ServiceNowErrorType["INSTANCE_UNAVAILABLE"] = "instance_unavailable";
    ServiceNowErrorType["INVALID_INSTANCE"] = "invalid_instance";
    // Permission errors
    ServiceNowErrorType["ACL_DENIED"] = "acl_denied";
    ServiceNowErrorType["ROLE_REQUIRED"] = "role_required";
    ServiceNowErrorType["TABLE_NOT_ACCESSIBLE"] = "table_not_accessible";
    // Execution errors
    ServiceNowErrorType["SCRIPT_TIMEOUT"] = "script_timeout";
    ServiceNowErrorType["SCRIPT_ERROR"] = "script_error";
    ServiceNowErrorType["SCRIPT_BLOCKED"] = "script_blocked";
    ServiceNowErrorType["QUERY_ERROR"] = "query_error";
    // Rate limiting
    ServiceNowErrorType["RATE_LIMITED"] = "rate_limited";
    ServiceNowErrorType["QUOTA_EXCEEDED"] = "quota_exceeded";
    // Safety blocks
    ServiceNowErrorType["DANGEROUS_OPERATION"] = "dangerous_operation";
    ServiceNowErrorType["SENSITIVE_DATA"] = "sensitive_data";
    // Generic
    ServiceNowErrorType["UNKNOWN_ERROR"] = "unknown_error";
})(ServiceNowErrorType || (ServiceNowErrorType = {}));
export class ServiceNowError extends Error {
    type;
    details;
    suggestion;
    constructor(type, message, details, suggestion) {
        super(message);
        this.type = type;
        this.details = details;
        this.suggestion = suggestion;
        this.name = 'ServiceNowError';
    }
    toJSON() {
        return {
            type: this.type,
            message: this.message,
            details: this.details,
            suggestion: this.suggestion,
        };
    }
}
//# sourceMappingURL=types.js.map