# M20W Dependency Install Note

Dependencies were installable in the sandbox.

Command used:

```bash
npm ci --ignore-scripts
```

Result:

- install succeeded;
- production dependency audit is clean;
- `npm audit --omit=dev` reported 0 vulnerabilities;
- dev/toolchain audit findings may still exist, but they are not production runtime dependencies.

Node/npm environment:

- Node: v22.16.0
- npm: 10.9.2

`ts-node` under this Node environment required explicit compiler options for generator scripts:

```bash
npx ts-node --compiler-options '{"module":"CommonJS","moduleResolution":"node"}' <script>
```
