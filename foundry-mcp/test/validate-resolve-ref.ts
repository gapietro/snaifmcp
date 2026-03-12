/**
 * resolveRefField regression tests (GitHub Issue #43)
 *
 * Tests the resolveRefField helper that prevents ServiceNow reference fields
 * from displaying as [object Object] when they are returned as objects
 * like { display_value: "ReAct", value: "react" } instead of plain strings.
 */

import { resolveRefField } from '../src/servicenow/tools-aia.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`\x1b[32m  PASS\x1b[0m ${message}`);
    passed++;
  } else {
    console.log(`\x1b[31m  FAIL\x1b[0m ${message}`);
    failed++;
  }
}

console.log('\n=== resolveRefField tests (Issue #43: Strategy [object Object] fix) ===\n');

// Plain string passthrough
assert(resolveRefField('ReAct') === 'ReAct', 'handles plain string "ReAct"');
assert(resolveRefField('ReActivePlanner') === 'ReActivePlanner', 'handles plain string "ReActivePlanner"');

// Object with display_value (primary ServiceNow reference field format)
assert(
  resolveRefField({ display_value: 'ReAct', value: 'react' }) === 'ReAct',
  'extracts display_value from { display_value: "ReAct", value: "react" }'
);

// Object with only value (no display_value)
assert(
  resolveRefField({ value: 'react' }) === 'react',
  'falls back to value when display_value is absent'
);

// Null returns default fallback
assert(resolveRefField(null) === 'N/A', 'returns "N/A" for null');

// Undefined returns default fallback
assert(resolveRefField(undefined) === 'N/A', 'returns "N/A" for undefined');

// Empty string returns fallback
assert(resolveRefField('') === 'N/A', 'returns "N/A" for empty string');

// Custom fallback parameter
assert(resolveRefField(null, 'Unknown') === 'Unknown', 'uses custom fallback "Unknown"');
assert(resolveRefField(undefined, 'none') === 'none', 'uses custom fallback "none"');

// Object with empty display_value falls back to value
assert(
  resolveRefField({ display_value: '', value: 'react' }) === 'react',
  'falls back to value when display_value is empty string'
);

// Empty object returns fallback
assert(resolveRefField({}) === 'N/A', 'returns "N/A" for empty object {}');

// The critical regression test: object must never produce "[object Object]"
const result1 = resolveRefField({ display_value: 'ReAct', value: 'react' });
assert(!result1.includes('[object Object]'), 'object with display_value never produces [object Object]');

const result2 = resolveRefField({ value: 'react' });
assert(!result2.includes('[object Object]'), 'object with only value never produces [object Object]');

const result3 = resolveRefField({});
assert(!result3.includes('[object Object]'), 'empty object never produces [object Object]');

// Summary
console.log(`\n=== Results: ${passed} passed, ${failed} failed out of ${passed + failed} ===\n`);

if (failed > 0) {
  process.exit(1);
}
