#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

const ROOT = 'web';
const AS_JSON = process.argv.includes('--json');

const SKIP = [
  /^web[\\/]vendor[\\/]/,
  /^web[\\/]docs[\\/]/,
  /^web[\\/]static-server\.js$/,
  /^web[\\/]publish-builder\.mjs$/,
];

const GLOBALS = new Set([
  'globalThis', 'undefined', 'NaN', 'Infinity', 'Object', 'Function', 'Boolean', 'Symbol', 'Error', 'EvalError',
  'RangeError', 'ReferenceError', 'SyntaxError', 'TypeError', 'URIError', 'AggregateError', 'Number', 'BigInt',
  'Math', 'Date', 'String', 'RegExp', 'Array', 'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array',
  'Uint16Array', 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array', 'BigInt64Array', 'BigUint64Array',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'WeakRef', 'FinalizationRegistry', 'ArrayBuffer', 'SharedArrayBuffer',
  'DataView', 'JSON', 'Promise', 'Reflect', 'Proxy', 'Intl', 'parseInt', 'parseFloat', 'isNaN', 'isFinite',
  'encodeURI', 'encodeURIComponent', 'decodeURI', 'decodeURIComponent', 'escape', 'unescape', 'eval',
  'window', 'document', 'navigator', 'location', 'history', 'screen', 'localStorage', 'sessionStorage', 'indexedDB',
  'caches', 'crypto', 'console', 'fetch', 'Headers', 'Request', 'Response', 'FormData', 'AbortController',
  'AbortSignal', 'URL', 'URLSearchParams', 'Blob', 'File', 'FileReader', 'FileList', 'Image', 'ImageData',
  'createImageBitmap', 'ImageBitmap', 'OffscreenCanvas', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'cancelIdleCallback', 'structuredClone', 'atob', 'btoa', 'TextEncoder', 'TextDecoder', 'TextEncoderStream',
  'TextDecoderStream', 'ReadableStream', 'WritableStream', 'TransformStream', 'MessageChannel', 'MessagePort',
  'BroadcastChannel', 'Worker', 'SharedWorker', 'WebSocket', 'EventSource', 'Event', 'CustomEvent', 'EventTarget',
  'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'PerformanceObserver', 'performance', 'matchMedia',
  'getComputedStyle', 'DOMParser', 'XMLSerializer', 'XMLHttpRequest', 'Notification', 'alert', 'confirm', 'prompt',
  'scrollTo', 'scrollBy', 'open', 'close', 'postMessage', 'addEventListener', 'removeEventListener', 'dispatchEvent',
  'CSS', 'Option', 'Audio', 'WebAssembly', 'Element', 'HTMLElement', 'HTMLImageElement', 'HTMLCanvasElement',
  'HTMLInputElement', 'HTMLTextAreaElement', 'HTMLSelectElement', 'HTMLButtonElement', 'HTMLAnchorElement',
  'HTMLFormElement', 'HTMLVideoElement', 'Node', 'NodeFilter', 'DocumentFragment', 'Range', 'Selection',
  'ClipboardItem', 'DOMException', 'DOMMatrix', 'DOMRect', 'Path2D', 'FontFace', 'IDBKeyRange', 'IDBRequest',
  'PublicKeyCredential', 'CompressionStream', 'DecompressionStream', 'reportError',
  'self', 'clients', 'registration', 'skipWaiting', 'importScripts', 'ExtendableEvent', 'FetchEvent',
  'WorkerGlobalScope', 'ServiceWorkerGlobalScope',
  'Telegram', 'TelegramWebviewProxy', 'lottie', 'plathoWallet',
]);

const FUNCTION_SCOPE = new Set(['Program', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'StaticBlock']);
const BLOCK_SCOPE = new Set([
  'Program', 'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'StaticBlock',
  'BlockStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'CatchClause',
  'ClassDeclaration', 'ClassExpression',
]);

function patternNames(node, out) {
  if (!node) return out;
  switch (node.type) {
    case 'Identifier': out.push(node.name); break;
    case 'ObjectPattern': for (const p of node.properties) patternNames(p.type === 'RestElement' ? p.argument : p.value, out); break;
    case 'ArrayPattern': for (const e of node.elements) patternNames(e, out); break;
    case 'AssignmentPattern': patternNames(node.left, out); break;
    case 'RestElement': patternNames(node.argument, out); break;
    default: break;
  }
  return out;
}

function collect(ast) {
  const scopes = new Map();
  const stack = [];
  const open = (node) => {
    const scope = { node, parent: stack[stack.length - 1] ?? null, names: new Set() };
    scopes.set(node, scope);
    stack.push(scope);
    return scope;
  };
  const nearest = (kinds) => { for (let i = stack.length - 1; i >= 0; i -= 1) if (kinds.has(stack[i].node.type)) return stack[i]; return stack[0]; };
  const declare = (names, kinds) => { const s = nearest(kinds); for (const n of names) s.names.add(n); };

  const visit = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;

    switch (node.type) {
      case 'VariableDeclaration':
        for (const d of node.declarations) {
          declare(patternNames(d.id, []), node.kind === 'var' ? FUNCTION_SCOPE : BLOCK_SCOPE);
        }
        break;
      case 'FunctionDeclaration':
        if (node.id) { declare([node.id.name], BLOCK_SCOPE); declare([node.id.name], FUNCTION_SCOPE); }
        break;
      case 'ClassDeclaration':
        if (node.id) declare([node.id.name], BLOCK_SCOPE);
        break;
      case 'ImportDeclaration':
        for (const spec of node.specifiers) declare([spec.local.name], FUNCTION_SCOPE);
        break;
      default: break;
    }

    const opened = BLOCK_SCOPE.has(node.type) || FUNCTION_SCOPE.has(node.type);
    if (opened) open(node);
    if (node.type === 'FunctionExpression' && node.id) declare([node.id.name], FUNCTION_SCOPE);
    if (/Function/.test(node.type) && Array.isArray(node.params)) {
      const names = []; for (const p of node.params) patternNames(p, names);
      declare(names, FUNCTION_SCOPE);
    }
    if (node.type === 'CatchClause' && node.param) declare(patternNames(node.param, []), BLOCK_SCOPE);
    if ((node.type === 'ClassDeclaration' || node.type === 'ClassExpression') && node.id) declare([node.id.name], BLOCK_SCOPE);


    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) { for (const child of value) visit(child, node); }
      else if (value && typeof value.type === 'string') visit(value, node);
    }
    if (opened) stack.pop();
  };

  visit(ast, null);
  return scopes;
}

function isReference(node, parent, key) {
  if (!parent) return true;
  switch (parent.type) {
    case 'MemberExpression': return !(key === 'property' && !parent.computed);
    case 'Property': return !(key === 'key' && !parent.computed);
    case 'PropertyDefinition': case 'MethodDefinition': return !(key === 'key' && !parent.computed);
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return key !== 'label';
    case 'ImportSpecifier': return false;
    case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': return false;
    case 'ExportSpecifier': return false;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
    case 'ClassDeclaration': case 'ClassExpression':
      return key !== 'id' && key !== 'params';
    case 'VariableDeclarator': return key !== 'id';
    case 'CatchClause': return key !== 'param';
    case 'ObjectPattern': case 'ArrayPattern': case 'RestElement': case 'AssignmentPattern': return false;
    case 'MetaProperty': return false;
    case 'UnaryExpression': return parent.operator !== 'typeof';
    default: return true;
  }
}

function featureDetected(ast) {
  const names = new Set();
  const walk = (node) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'UnaryExpression' && node.operator === 'typeof' && node.argument?.type === 'Identifier') {
      names.add(node.argument.name);
    }
    for (const key of Object.keys(node)) {
      if (key === 'type' || key === 'start' || key === 'end' || key === 'loc') continue;
      const value = node[key];
      if (Array.isArray(value)) { for (const child of value) walk(child); }
      else if (value && typeof value.type === 'string') walk(value);
    }
  };
  walk(ast);
  return names;
}

function checkFile(file) {
  const source = readFileSync(file, 'utf8');
  let ast;
  try {
    ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true });
  } catch {
    return [];
  }
  const scopes = collect(ast);
  const detected = featureDetected(ast);
  const found = [];
  const seen = new Set();
  const walk = (node, parent, key, chain) => {
    if (!node || typeof node.type !== 'string') return;
    const scope = scopes.get(node);
    const next = scope ? [...chain, scope] : chain;
    if (node.type === 'Identifier' && isReference(node, parent, key)) {
      const name = node.name;
      if (!GLOBALS.has(name) && !detected.has(name)) {
        let declared = false;
        for (let i = next.length - 1; i >= 0; i -= 1) if (next[i].names.has(name)) { declared = true; break; }
        if (!declared) {
          const at = `${name}@${node.loc.start.line}`;
          if (!seen.has(at)) { seen.add(at); found.push({ name, line: node.loc.start.line }); }
        }
      }
    }
    for (const k of Object.keys(node)) {
      if (k === 'type' || k === 'start' || k === 'end' || k === 'loc') continue;
      const value = node[k];
      if (Array.isArray(value)) { for (const child of value) walk(child, node, k, next); }
      else if (value && typeof value.type === 'string') walk(value, node, k, next);
    }
  };
  walk(ast, null, null, []);
  return found;
}

const files = [];
(function sweep(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { sweep(path); continue; }
    if (!/\.(mjs|js)$/.test(entry)) continue;
    if (SKIP.some((re) => re.test(path))) continue;
    files.push(path);
  }
}(ROOT));

const report = [];
for (const file of files.sort()) {
  for (const hit of checkFile(file)) report.push({ file: file.replace(/\\/g, '/'), ...hit });
}

if (AS_JSON) {
  console.log(JSON.stringify({ ok: report.length === 0, files: files.length, findings: report }, null, 2));
} else if (report.length === 0) {
  console.log(`[undeclared] clean — ${files.length} file(s), every name a read resolves to a declaration or a known global.`);
} else {
  for (const hit of report) console.error(`${hit.file}:${hit.line}  ${hit.name} is read but never declared`);
  console.error(`\n[undeclared] ${report.length} finding(s) across ${files.length} file(s).`);
  console.error('A name that resolves to nothing throws at RUNTIME, where neither node --check nor a source-reading');
  console.error('gate will meet it. If a finding is a real browser global this list does not know, add it to');
  console.error('GLOBALS in scripts/check_undeclared_identifiers.mjs — never silence the file.');
}
process.exit(report.length === 0 ? 0 : 1);
