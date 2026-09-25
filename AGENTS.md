# Project Guidelines

Refer to official Tavily SDK reference at <https://docs.tavily.com/sdk/javascript/reference>

## Style

- don't add unnecessary inline comments, prefer function documentation

## Package Management

- **Package Manager:** Use [PNPM](https://pnpm.io) for all package management operations

## Linting and Type Checking

- run `pnpm run lint:fix` and `pnpm run format:fix` to keep all things tidy
- don't consider any change ready until `pnpm run check`, `pnpm run lint` and `pnpm run format` are returning 0 errors and 0 warnings.
