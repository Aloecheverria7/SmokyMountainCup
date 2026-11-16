# Project instructions

- Read `docs/specs/README.md` and the relevant RF/MIG before changing behavior.
- The existing landing must keep its visual design, content, responsive layout and observable functionality. Reuse the CSS/assets; do not redesign. Run `test:parity` against a PHP reference for visual changes.
- Four independent competitions: Infantil, Junior, Adulto, Femenino; each has groups A/B. Never infer legacy group mapping or age rules.
- Never execute migrations or tests against production. The legacy adapter is read-only; use an isolated database copy and SELECT-only credentials.
- Do not commit operational SQL, secrets, session data or generated screenshots. Keep `.env.example` safe.
- Do not present foundation placeholders as completed features. Update `docs/BOOTSTRAP.md` when implementing a pending module.
- Validate relevant changes with typecheck/build, unit tests, API smoke and browser tests. Do not claim unexecuted checks.
