# Contributing

Small fixes are the most useful kind: an upstream field was renamed, a city does not resolve, or a
keyboard interaction misbehaves.

```sh
npm install
npm test            # offline — no network
npm run test:live   # real Israel Post API (never in CI)
npm run typecheck
npm run demo        # manual check in the browser
```

- TypeScript strict mode. Do not add runtime dependencies.
- When an upstream payload changes, keep the parser tolerant of both shapes when you can, and add a
  unit test with a small **synthetic** fixture.
- Lookups never throw on network or upstream errors. Keep it that way.
