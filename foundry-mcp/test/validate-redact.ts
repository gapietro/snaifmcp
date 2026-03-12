/**
 * Credential Redaction Tests (Issue #45)
 *
 * Tests the redaction utility that prevents accidental exposure
 * of passwords, tokens, and other secrets in tool output.
 */

import {
  handleServiceNowTool,
  connectionManager,
} from '../src/servicenow/index.js';
import {
  redactString,
  redactArgs,
  REDACTED,
} from '../src/shared/redact.js';
import { TestRunner } from './utils/test-runner.js';

const t = new TestRunner();

function pass(message: string): void {
  t.pass(message, message);
}

function fail(message: string): void {
  t.fail(message, message);
}

function section(title: string): void {
  t.log(title, 'header');
}

async function runTests(): Promise<void> {
  t.log('===================================================', 'header');
  t.log('  CREDENTIAL REDACTION TESTS (Issue #45)', 'header');
  t.log('===================================================', 'header');

  // ── redactString Tests ──────────────────────────────────────
  section('redactString');

  // Strips passwords from curl -u flags
  const curlOutput = "curl -u 'admin:SuperSecret123' https://instance.com";
  const redactedCurl = redactString(curlOutput);
  if (!redactedCurl.includes('SuperSecret123')) {
    pass('Strips password from curl -u flag');
  } else {
    fail('Should strip password from curl -u flag');
  }
  if (redactedCurl.includes(REDACTED)) {
    pass('Replaces password with REDACTED placeholder');
  } else {
    fail('Should use REDACTED placeholder, got: ' + redactedCurl);
  }

  // Strips Base64-encoded credentials
  const base64Creds = 'Authorization: Basic YWRtaW46U3VwZXJTZWNyZXQxMjM=';
  const redactedBase64 = redactString(base64Creds);
  if (!redactedBase64.includes('YWRtaW46U3VwZXJTZWNyZXQxMjM=')) {
    pass('Strips Base64 credentials from Authorization header');
  } else {
    fail('Should strip Base64 credentials');
  }

  // Strips Bearer tokens
  const bearerOutput = 'Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.abc123.xyz';
  const redactedBearer = redactString(bearerOutput);
  if (!redactedBearer.includes('eyJhbGciOiJSUzI1NiJ9')) {
    pass('Strips Bearer tokens');
  } else {
    fail('Should strip Bearer tokens');
  }

  // Preserves non-sensitive content
  const safeOutput = 'Connected to https://dev12345.service-now.com User: admin';
  const redactedSafe = redactString(safeOutput);
  if (redactedSafe === safeOutput) {
    pass('Preserves non-sensitive content unchanged');
  } else {
    fail('Should not modify non-sensitive content');
  }

  // Handles empty string
  if (redactString('') === '') {
    pass('Handles empty string');
  } else {
    fail('Should return empty string for empty input');
  }

  // Strips password= query parameter patterns
  const urlWithPassword = 'https://instance.com?password=MySecret&user=admin';
  const redactedUrl = redactString(urlWithPassword);
  if (!redactedUrl.includes('MySecret')) {
    pass('Strips password from URL query parameters');
  } else {
    fail('Should strip password from URL query parameters');
  }

  // ── redactArgs Tests ──────────────────────────────────────
  section('redactArgs');

  const argsWithCreds = {
    instance: 'dev12345.service-now.com',
    username: 'admin',
    password: 'SuperSecret123',
    token: 'my-api-token',
    clientSecret: 'oauth-secret-value',
    authType: 'basic',
  };
  const sanitized = redactArgs(argsWithCreds);

  if (sanitized.instance === 'dev12345.service-now.com') {
    pass('Preserves non-sensitive fields (instance)');
  } else {
    fail('Should preserve instance');
  }
  if (sanitized.password === REDACTED) {
    pass('Redacts password field');
  } else {
    fail('Should redact password, got: ' + sanitized.password);
  }
  if (sanitized.token === REDACTED) {
    pass('Redacts token field');
  } else {
    fail('Should redact token, got: ' + sanitized.token);
  }
  if (sanitized.clientSecret === REDACTED) {
    pass('Redacts clientSecret field');
  } else {
    fail('Should redact clientSecret, got: ' + sanitized.clientSecret);
  }
  if (sanitized.username === 'admin') {
    pass('Preserves username (not a secret)');
  } else {
    fail('Should preserve username');
  }
  if (sanitized.authType === 'basic') {
    pass('Preserves authType (not a secret)');
  } else {
    fail('Should preserve authType');
  }

  const emptyRedacted = redactArgs({});
  if (Object.keys(emptyRedacted).length === 0) {
    pass('Handles empty object');
  } else {
    fail('Should return empty object for empty input');
  }

  // ── Tool Output Safety ──────────────────────────────────────
  section('Tool Output Safety');

  // Connect tool output never contains credentials
  const connectWithCreds = await handleServiceNowTool('servicenow_connect', {
    instance: 'fake-instance.service-now.com',
    username: 'admin',
    password: 'TestPassword789!',
  });
  if (connectWithCreds) {
    const outputText = connectWithCreds.content[0].text;
    if (!outputText.includes('TestPassword789!')) {
      pass('Connect tool output does not contain password');
    } else {
      fail('Connect tool output MUST NOT contain password');
    }
  }

  // getStatus() never exposes authConfig
  const statusOutput = connectionManager.getStatus();
  const statusStr = JSON.stringify(statusOutput);
  if (!statusStr.includes('password') && !statusStr.includes('secret') && !statusStr.includes('token')) {
    pass('getStatus() does not expose credential fields');
  } else {
    fail('getStatus() MUST NOT expose credential fields');
  }

  // Summary
  t.log('===================================================', 'header');
  t.log('  SUMMARY', 'header');
  t.log('===================================================', 'header');

  const { failed: failCount } = t.printSummary();

  if (failCount > 0) {
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Test error:', error);
  process.exit(1);
});
