# Project Guidelines

Refer to official Tavily SDK reference at <https://docs.tavily.com/sdk/javascript/reference>

## Style

- don't add unnecessary inline comments, prefer function documentation

## Package Management

- **Package Manager:** Use [Bun](https://bun.sh) for all package management operations

## Linting and Type Checking

- run `bun run lint:fix` and `bun run format:fix` to keep all things tidy
- don't consider any change ready until `bun run check`, `bun run lint` and `bun run format` are returning 0 errors and 0 warnings.
