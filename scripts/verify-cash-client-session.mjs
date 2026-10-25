// Isolated observable checks for API responses crossing a sign-in boundary.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(new URL('../frontend/package.json', import.meta.url));
const ts = require('typescript');
const source = readFileSync(new URL('../frontend/src/lib/api.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
let logouts = 0, toasts = 0;
let state = { user: { id: 'fictional-owner-a' }, token: null, isAuthenticated: true, logout: () => { logouts++; } };
let resolveFetch;
const apiExports = {};
vm.runInNewContext(compiled, {
  exports: apiExports, process: { env: {} }, Date, FormData, URLSearchParams,
  fetch: () => new Promise(resolve => { resolveFetch = resolve; }),
  require: name => {
    if (name === '@/stores/auth-store') return { useAuthStore: { getState: () => state } };
    if (name === '@/stores/toast-store') return { useToastStore: { getState: () => ({ addToast: () => { toasts++; } }) } };
    throw new Error('Unexpected runtime import: ' + name);
  },
});
let response = apiExports.fetchJSON('/api/cash/workspaces');
state = { ...state, user: { id: 'fictional-owner-b' } };
resolveFetch(new Response('{}', { status: 401 }));
await assert.rejects(response, error => error.status === 409);
assert.equal(logouts, 0); assert.equal(toasts, 0);
response = apiExports.fetchJSON('/api/cash/workspaces');
state = { ...state, user: { id: 'fictional-owner-c' } };
resolveFetch(new Response(JSON.stringify({ private: 'old owner data' }), { status: 200 }));
await assert.rejects(response, error => error.status === 409);
response = apiExports.fetchJSON('/api/cash/workspaces');
resolveFetch(new Response(JSON.stringify([{ name: 'Current owner workspace' }]), { status: 200 }));
assert.equal((await response)[0].name, 'Current owner workspace');
response = apiExports.fetchJSON('/api/cash/workspaces');
resolveFetch(new Response(JSON.stringify({ detail: [{ loc: ['body', 'amount'], msg: 'At most two decimal places', input: 'unnecessary private input' }] }), { status: 422 }));
await assert.rejects(response, error => error.detail === 'amount: At most two decimal places' && !error.detail.includes('private'));
console.log('PASS: old 401 preserves newer sign-in; old success rejected; current response accepted; validation detail is readable and excludes raw inputs');
