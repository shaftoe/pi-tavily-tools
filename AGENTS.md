# Project Guidelines

Refer to official Tavily SDK reference at <https://docs.tavily.com/sdk/javascript/reference>

## Style

- don't add unnecessary inline comments, prefer function documentation

## Package Management

- **Package Manager:** Use [Bun](https://bun.sh) for all package management operations
  - Install dependencies: `bun install`
  - Add dependencies: `bun add <package>`
  - Add dev dependencies: `bun add -d <package>`
  - Update dependencies: `bun update`

- **Why Bun:** Faster than npm/pnpm/yarn, native TypeScript support, built-in test runner

## TypeScript

- **Version:** TypeScript >= 6.0.0 (use latest stable version)
- **Strict Mode:** Enable all strict compiler options
- **Module System:** ESM (`"module": "ES2022"`, `"type": "module"` in package.json)

## Linting and Type Checking

### Required Dependencies

```bash
bun add -d typescript
bun add -d @types/node  # if using Node.js APIs
bun add -d @mariozechner/pi-coding-agent @sinclair/typebox
```

### Scripts (package.json)

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "check": "tsc --noEmit",
    "check:watch": "tsc --noEmit --watch",
    "lint": "echo 'Linting not configured yet'",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "clean": "rm -rf node_modules bun.lockb",
    "reinstall": "bun run clean && bun install"
  }
}
```

### Type Checking

Always run type checking before committing:

```bash
bun run check
```

Enable `check:watch` during development for instant feedback:

```bash
bun run check:watch
```

## Best Practices

### Code Style

1. **Use modern TypeScript syntax:**
   - Prefer `const` assertions for literals
   - Use `satisfies` operator for type validation
   - Use template literals over string concatenation

2. **Type Safety:**
   - Avoid `any` and `unknown` - use proper types
   - Use `readonly` for arrays that shouldn't be mutated
   - Prefer `interface` for public APIs, `type` for unions/intersections

3. **Error Handling:**
   - Always handle errors explicitly with try-catch
   - Provide meaningful error messages
   - Use custom error types for domain-specific errors

4. **Imports:**
   - Use ES module syntax (`import`/`export`)
   - Use `.js` extensions for relative imports (ESM requirement)
   - Group imports: stdlib → third-party → local

### Pi Extension Specific

1. **Tool Registration:**
   - Use `Type.Object()` with `@sinclair/typebox` for schemas
   - Use `StringEnum` from `@mariozechner/pi-ai` for string enums
   - Always truncate output (50KB / 2000 lines)
   - Implement `renderCall` and `renderResult` for better TUI

2. **Session Management:**
   - Store state in tool result `details` for branching
   - Reconstruct state from `sessionManager` on `session_start`
   - Use `appendEntry` for persistent but non-LLM data

3. **API Keys:**
   - Read from environment variables only
   - Never commit keys to git
   - Provide clear error messages when keys are missing

## Dependencies

Always use the latest stable versions

### Peer Dependencies

These are provided by Pi runtime and should NOT be bundled:

- `@mariozechner/pi-coding-agent` (peerDependency)
- `@mariozechner/pi-ai` (peerDependency)
- `@mariozechner/pi-tui` (peerDependency)
- `@sinclair/typebox` (peerDependency)

## Testing

### Test Framework

Use Bun's built-in test runner:

```typescript
// Example test file: tests/integration/web-search.test.ts
import { test, expect } from "bun:test";

test("web search works", async () => {
  const result = await webSearch({ query: "test" });
  expect(result).toBeDefined();
});
```

## Version Management

### Semantic Release

This project uses [semantic-release](https://github.com/semantic-release/semantic-release) for automated version management and publishing. Releases are triggered automatically when commits are pushed to the `master` branch.

### Release Process

1. **Conventional Commits:** Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:
   - `feat: add new feature` → **minor** version bump
   - `fix: fix a bug` → **patch** version bump
   - `feat!: breaking change` or `fix!: breaking change` → **major** version bump
   - `chore: update dependencies` → no version bump (internal change)

2. **Automatic Releases:** When you push to `master`:
   - CI runs tests and coverage
   - `semantic-release` analyzes commits to determine version bump
   - Creates a git tag (e.g., `v0.4.0`)
   - Updates `CHANGELOG.md` automatically
   - Publishes to npm with provenance
   - Creates GitHub release

3. **Local Testing:** Before pushing, you can test locally:

   ```bash
   bun run release:dry-run  # Preview what would be released
   ```

4. **Manual Release Scripts:**
   ```bash
   bun run release           # Run semantic-release locally
   ```

### Changelog

The `CHANGELOG.md` is automatically maintained by `semantic-release`. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

### Dependency Updates

Keep dependencies updated regularly with `bun update`. Peer dependencies versions are managed separately in `package.json`.

---

**Remember:** These guidelines are living documents. Update them as the project evolves and new best practices emerge.
