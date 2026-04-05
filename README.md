# Pi Tavily Web Search Extension

[![codecov](https://codecov.io/gh/shaftoe/pi-tavily-tools/graph/badge.svg?token=jFWEnUSop4)](https://codecov.io/gh/shaftoe/pi-tavily-tools)

Add web search capabilities to Pi using the Tavily search API.

This extension provides a `web_search` tool that the LLM can use to find current information, recent news, documentation, and time-sensitive data.

Requires a valid `TAVILY_API_KEY` exported in the enviornment, e.g.

```bash
TAVILY_API_KEY=tvly-xxxx-xxxxxxx-xxxxxxxxxx pi
```

You can get a free one at <https://tavily.com>

## Features

- **Web Search:** Query the web for real-time information
- **AI-Generated Answers:** Get direct answers to questions powered by Tavily
- **Configurable Depth:** Choose between "basic" and "advanced" search modes
- **Time Filtering:** Limit results to recent timeframes (e.g., last 7 days)
- **Image Support:** Include relevant images in search results
- **Content Extraction:** Optional raw content for deeper analysis
- **Proper Truncation:** Output truncated to 50KB / 2000 lines to avoid context overflow
- **Custom TUI Rendering:** Beautiful display with expandable results
- **Error Handling:** Graceful failures with helpful error messages

## Installation

### Option 1: Install from npm (Recommended)

```bash
pi install npm:@alexanderfortin/pi-tavily-tools
```

### Option 2: Install from Git

```bash
pi install git:github.com/shaftoe/pi-tavily-tools
```

### Option 3: Quick Test with -e flag

```bash
git clone https://github.com/shaftoe/pi-tavily-tools
cd pi-tavily-tools
pi -e ./src/index.ts
```

## Setup

### 1. Get a Tavily API Key

Visit <https://tavily.com> and sign up for a free account. The free tier includes:

- 1,000 requests per month
- Basic search depth
- Standard rate limits

### 2. Configure the API Key

Set the `TAVILY_API_KEY` environment variable:

```bash
export TAVILY_API_KEY="your-api-key-here"
```

**Add to your shell profile** (~/.zshrc, ~/.bashrc, etc.) for persistent access:

```bash
echo 'export TAVILY_API_KEY="your-api-key-here"' >> ~/.zshrc
source ~/.zshrc
```

## Usage

### Basic Web Search

Simply ask Pi to search the web:

```
Search for the latest version of React
```

```
What are the new features in TypeScript 6.0?
```

```
Find recent news about artificial intelligence
```

### Time-Limited Search

Limit results to a specific timeframe:

```
Search for AI news from the last 7 days
```

```
Show me the latest JavaScript updates from the past 30 days
```

### Advanced Search

Use advanced search depth for more detailed results:

```
Search for quantum computing trends using advanced search
```

### Image Search

Include relevant images in results:

```
Find cute cats with images
```

### Raw Content

Get detailed content from search results:

```
Search for Bun test runner documentation and include raw content
```

## Available Parameters

The `web_search` tool accepts the following parameters:

| Parameter             | Type    | Required | Default | Description                                    |
| --------------------- | ------- | -------- | ------- | ---------------------------------------------- |
| `query`               | string  | Yes      | -       | The search query string                        |
| `max_results`         | number  | No       | 5       | Number of results to return (1-20)             |
| `search_depth`        | string  | No       | "basic" | Search depth: "basic" or "advanced"            |
| `include_answer`      | boolean | No       | true    | Include AI-generated answer                    |
| `include_raw_content` | boolean | No       | false   | Include raw page content (markdown or text)    |
| `include_images`      | boolean | No       | false   | Include relevant images                        |
| `days`                | number  | No       | -       | Limit results to last N days (e.g., 7, 30, 90) |

### Parameter Examples

```typescript
// Basic search
{ query: "TypeScript 6" }

// Time-limited search
{ query: "AI news", days: 7 }

// Advanced search with more results
{ query: "quantum computing", search_depth: "advanced", max_results: 10 }

// Search with images
{ query: "cute cats", include_images: true }

// Search with raw content
{ query: "Bun documentation", include_raw_content: true }
```

## Output Truncation

To prevent overwhelming the LLM context, tool output is truncated to:

- **50KB** of data
- **2,000 lines** of text

Whichever limit is hit first triggers truncation.

When output is truncated:

- A warning is displayed in the results
- Full output is saved to a temp file in your project directory: `.pi-tavily-temp/search-{timestamp}.txt`
- The LLM is informed where to find the complete output

## Troubleshooting

### "TAVILY_API_KEY is not set"

**Error Message:**

```
Error: TAVILY_API_KEY environment variable is not set.
```

**Solution:**

1. Get an API key from <https://tavily.com>
2. Set the environment variable:
   ```bash
   export TAVILY_API_KEY="your-api-key-here"
   ```
3. Add to your shell profile for persistence:
   ```bash
   echo 'export TAVILY_API_KEY="your-api-key-here"' >> ~/.zshrc
   source ~/.zshrc
   ```

### "Failed to initialize Tavily client"

**Error Message:**

```
Error: Failed to initialize Tavily client: ...
```

**Possible Causes:**

1. Invalid API key format
2. Network connectivity issues
3. Tavily API is down

**Solutions:**

1. Verify your API key is correct (should start with "tvly-")
2. Check your internet connection
3. Try a simple curl test:
   ```bash
   curl -X POST https://api.tavily.com/search \\
     -H "Content-Type: application/json" \\
     -d '{"api_key":"YOUR_KEY","query":"test","max_results":1}'
   ```

### Rate Limit Errors

**Error Message:**

```
Error: You have exceeded your monthly request limit
```

**Solution:**

- The free tier includes 1,000 requests per month
- Upgrade your Tavily plan if you need more requests
- Visit <https://tavily.com/pricing> for details

### No Results Found

**Symptoms:**

- Search returns "No results found."
- Empty results list

**Solutions:**

1. Try a broader or different search query
2. Check spelling of your query
3. Remove any special characters or complex filters
4. Try basic search depth instead of advanced

## Development

### Project Structure

```
pi-tavily-tools/
├── .github/
│   └── dependabot.yml    # Dependency update configuration
├── .envrc                # Direnv configuration for API keys
├── .gitignore
├── .prettierignore
├── .prettierrc           # Prettier code formatter config
├── AGENTS.md             # Project guidelines for Pi agents
├── LICENSE
├── README.md
├── bun.lock
├── eslint.config.js      # ESLint linting config
├── lefthook.yml          # Git hooks configuration
├── package.json          # Package manifest
├── tsconfig.json         # TypeScript compiler config
├── src/
│   ├── index.ts          # Extension entry point
│   └── tools/
│       ├── index.ts      # Tool exports
│       ├── web-search.ts # Web search tool implementation
│       ├── tavily/       # Tavily API integration
│       │   ├── client.ts     # Tavily client & initialization
│       │   ├── formatters.ts # Response formatting
│       │   ├── renderers.ts  # TUI rendering utilities
│       │   ├── schemas.ts    # TypeBox parameter schemas
│       │   └── types.ts      # Type definitions
│       └── shared/       # Shared utilities
│           └── truncation.ts # Output truncation utilities
└── tests/
    ├── integration/      # Integration tests
    │   └── web-search.test.ts
    ├── client.test.ts
    ├── create-error-output.test.ts
    ├── formatters.test.ts
    ├── renderers.test.ts
    ├── schemas.test.ts
    └── truncation.test.ts
```

### Running Type Checks

```bash
bun run check
```

Watch mode for instant feedback during development:

```bash
bun run check:watch
```

### Running Tests

```bash
bun run test
```

Watch mode for continuous testing:

```bash
bun run test:watch
```

Run only integration tests (requires valid API key):

```bash
bun test tests/integration/
```

### Running Linting

```bash
bun run lint
```

### Formatting Code

```bash
bun run format:fix
```

### All Checks

Run all checks before committing:

```bash
bun run check && bun run lint && bun run test
```

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

- **GitHub Issues:** [shaftoe/pi-tavily-tools/issues](https://github.com/shaftoe/pi-tavily-tools/issues)
- **Tavily Documentation:** [https://docs.tavily.com](https://docs.tavily.com)
- **Pi Documentation:** [https://shittycodingagent.ai](https://shittycodingagent.ai)

## Releasing

This project uses automated publishing to NPM via GitHub Actions. The workflow will:

- Run all CI checks
- Build the package
- Publish to NPM with provenance (signed) via [trusted publishing](https://docs.npmjs.com/trusted-publishers)

## Acknowledgments

Built with:

- [Tavily API](https://tavily.com) - Web search and AI answers
- [Pi Coding Agent](https://pi.dev) - Extension framework
- [Bun](https://bun.sh) - Package manager and test runner
