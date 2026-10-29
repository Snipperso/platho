#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'acorn';

const ROOT = 'web';

const SKIP = [
  /^web[\\/]vendor[\\/]/,
  /^web[\\/]docs[\\/]/,
  /^web[\\/]static-server\.js$/,
];

const FUNCTION_NODES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'StaticBlock', 'ClassBody']);
const BLOCK_NODES = new Set(['Program', 'BlockStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement', 'SwitchStatement', 'CatchClause']);
const PATTERN_NODES = new Set(['ObjectPattern', 'ArrayPattern', 'AssignmentPattern', 'RestElement']);
const SKIPPED_KEYS = new Set(['type', 'start', 'end', 'loc', 'range']);

function patternNames(node, out = []) {
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

function directStatements(node) {
  switch (node.type) {
    case 'Program': case 'BlockStatement': case 'StaticBlock': return node.body;
    case 'SwitchStatement': return node.cases.flatMap((c) => c.consequent);
    case 'ForStatement': return node.init ? [node.init] : [];
    case 'ForInStatement': case 'ForOfStatement': return [node.left];
    default: return [];
  }
}

function varNames(node, out = []) {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'VariableDeclaration' && node.kind === 'var') for (const d of node.declarations) patternNames(d.id, out);
  for (const key of Object.keys(node)) {
    if (SKIPPED_KEYS.has(key)) continue;
    const value = node[key];
    if (Array.isArray(value)) { for (const child of value) if (child && typeof child.type === 'string' && !FUNCTION_NODES.has(child.type)) varNames(child, out); }
    else if (value && typeof value.type === 'string' && !FUNCTION_NODES.has(value.type)) varNames(value, out);
  }
  return out;
}

function isReference(parent, key) {
  if (!parent) return true;
  switch (parent.type) {
    case 'MemberExpression': return !(key === 'property' && !parent.computed);
    case 'Property': return !(key === 'key' && !parent.computed);
    case 'PropertyDefinition': case 'MethodDefinition': return !(key === 'key' && !parent.computed);
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return key !== 'label';
    case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ExportSpecifier': return false;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
    case 'ClassDeclaration': case 'ClassExpression':
      return key !== 'id';
    case 'MetaProperty': return false;
    default: return true;
  }
}

export function findTemporalDeadZoneReads(source, { sourceType = 'module' } = {}) {
  const ast = parse(source, { ecmaVersion: 'latest', sourceType, allowHashBang: true, locations: true, allowAwaitOutsideFunction: true, allowReturnOutsideFunction: true });
  const findings = [];
  const stack = [];
  const hoisted = { lexical: false, initEnd: 0, line: 0 };
  const declareIn = (scope, name, entry) => { if (!scope.names.has(name)) scope.names.set(name, entry); };

  const openBlock = (node, fnDepth) => {
    const scope = { names: new Map(), fnDepth };
    for (const raw of directStatements(node)) {
      const statement = raw?.type === 'ExportNamedDeclaration' || raw?.type === 'ExportDefaultDeclaration' ? raw.declaration : raw;
      if (!statement || typeof statement.type !== 'string') continue;
      if (statement.type === 'VariableDeclaration') {
        for (const d of statement.declarations) {
          for (const name of patternNames(d.id)) {
            declareIn(scope, name, statement.kind === 'var' ? hoisted : { lexical: true, initEnd: d.end, line: d.loc.start.line });
          }
        }
      } else if (statement.type === 'ClassDeclaration' && statement.id) {
        declareIn(scope, statement.id.name, { lexical: true, initEnd: statement.end, line: statement.loc.start.line });
      } else if (statement.type === 'FunctionDeclaration' && statement.id) {
        declareIn(scope, statement.id.name, hoisted);
      } else if (statement.type === 'ImportDeclaration') {
        for (const spec of statement.specifiers) declareIn(scope, spec.local.name, hoisted);
      }
    }
    if (node.type === 'CatchClause' && node.param) for (const name of patternNames(node.param)) declareIn(scope, name, hoisted);
    if (node.type === 'Program') for (const name of varNames(node)) declareIn(scope, name, hoisted);
    stack.push(scope);
  };

  const resolve = (name) => {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const entry = stack[i].names.get(name);
      if (entry) return { entry, scope: stack[i] };
    }
    return null;
  };

  const read = (node, fnDepth) => {
    const found = resolve(node.name);
    if (found && found.entry.lexical && node.start < found.entry.initEnd && found.scope.fnDepth === fnDepth) {
      findings.push({ name: node.name, line: node.loc.start.line, column: node.loc.start.column + 1, declaredAtLine: found.entry.line });
    }
  };

  const visitPattern = (node, fnDepth, writes) => {
    if (!node || typeof node.type !== 'string') return;
    switch (node.type) {
      case 'Identifier': if (writes) read(node, fnDepth); return;
      case 'ObjectPattern':
        for (const p of node.properties) {
          if (p.type === 'RestElement') { visitPattern(p.argument, fnDepth, writes); continue; }
          if (p.computed) visit(p.key, p, 'key', fnDepth);
          visitPattern(p.value, fnDepth, writes);
        }
        return;
      case 'ArrayPattern': for (const e of node.elements) visitPattern(e, fnDepth, writes); return;
      case 'AssignmentPattern': visitPattern(node.left, fnDepth, writes); visit(node.right, node, 'right', fnDepth); return;
      case 'RestElement': visitPattern(node.argument, fnDepth, writes); return;
      default: visit(node, null, null, fnDepth); return;
    }
  };

  const visit = (node, parent, key, fnDepth) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'Identifier') {
      if (isReference(parent, key)) read(node, fnDepth);
      return;
    }
    let depth = fnDepth;
    let pushed = 0;
    if (FUNCTION_NODES.has(node.type)) {
      depth += 1;
      const scope = { names: new Map(), fnDepth: depth };
      if (Array.isArray(node.params)) for (const p of node.params) for (const name of patternNames(p)) declareIn(scope, name, hoisted);
      if (node.type === 'FunctionExpression' && node.id) declareIn(scope, node.id.name, hoisted);
      if (node.body && node.body.type === 'BlockStatement') for (const name of varNames(node.body)) declareIn(scope, name, hoisted);
      stack.push(scope);
      pushed += 1;
    }
    if (BLOCK_NODES.has(node.type)) { openBlock(node, depth); pushed += 1; }

    switch (node.type) {
      case 'VariableDeclarator':
        visitPattern(node.id, depth, false);
        visit(node.init, node, 'init', depth);
        break;
      case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression':
        for (const p of node.params) visitPattern(p, depth, false);
        visit(node.body, node, 'body', depth);
        break;
      case 'CatchClause':
        visitPattern(node.param, depth, false);
        visit(node.body, node, 'body', depth);
        break;
      case 'AssignmentExpression':
        if (PATTERN_NODES.has(node.left.type)) visitPattern(node.left, depth, true); else visit(node.left, node, 'left', depth);
        visit(node.right, node, 'right', depth);
        break;
      case 'ForInStatement': case 'ForOfStatement':
        if (node.left.type === 'VariableDeclaration') visit(node.left, node, 'left', depth);
        else if (PATTERN_NODES.has(node.left.type)) visitPattern(node.left, depth, true);
        else visit(node.left, node, 'left', depth);
        visit(node.right, node, 'right', depth);
        visit(node.body, node, 'body', depth);
        break;
      default:
        for (const childKey of Object.keys(node)) {
          if (SKIPPED_KEYS.has(childKey)) continue;
          const value = node[childKey];
          if (Array.isArray(value)) { for (const child of value) visit(child, node, childKey, depth); }
          else if (value && typeof value.type === 'string') visit(value, node, childKey, depth);
        }
    }
    while (pushed > 0) { stack.pop(); pushed -= 1; }
  };

  visit(ast, null, null, 0);
  return findings;
}

export function scanTree(root = ROOT) {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (SKIP.some((re) => re.test(path))) continue;
      if (statSync(path).isDirectory()) { walk(path); continue; }
      if (/\.(m?js)$/.test(name)) files.push(path);
    }
  };
  walk(root);
  const out = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    let findings;
    try {
      findings = findTemporalDeadZoneReads(source, { sourceType: 'module' });
    } catch {
      findings = findTemporalDeadZoneReads(source, { sourceType: 'script' });
    }
    for (const finding of findings) out.push({ file, ...finding });
  }
  return { files: files.length, findings: out };
}

if (process.argv[1] && /check_tdz\.mjs$/.test(process.argv[1])) {
  const { files, findings } = scanTree(ROOT);
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ files, findings }, null, 2));
  } else if (findings.length === 0) {
    console.log(`[tdz] clean — ${files} file(s), no lexical name is read before its declaration in the same function.`);
  } else {
    for (const f of findings) console.log(`[tdz] ${f.file}:${f.line}:${f.column} '${f.name}' is read before its declaration on line ${f.declaredAtLine}`);
    console.log(`[tdz] ${findings.length} finding(s) in ${files} file(s)`);
  }
  process.exit(findings.length === 0 ? 0 : 1);
}
