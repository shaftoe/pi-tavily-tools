# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.8] - 2026-04-14

### Changed

- update all deps to latest

### Fixed

- bump release

## [0.5.7] - 2026-04-10

### Fixed

- update lastFetchTime on 429 error to respect cooldown

## [0.5.6] - 2026-04-09

### Changed

- trim agents

### Fixed

- handle 429 rate limit errors on Tavily usage endpoint

## [0.5.5] - 2026-04-09

### Changed

- extract temp dir helpers and rename TavilyUsageCache to UsageCache

### Fixed

- remove double counting in status when paygo is enabled

## [0.5.4] - 2026-04-08

### Fixed

- relax FETCH_COOLDOWN_MS to 2 minutes

## [0.5.3] - 2026-04-08

### Changed

- fix the changelog
- add barrel imports for usage

### Fixed

- ensure default max result is consistent

## [0.5.2] - 2026-04-08

### Changed

- add session-level result cache to avoid redundant extract calls

## [0.5.1] - 2026-04-08

### Fixed

- ensure release process create a clean changelog

## [0.5.0] - 2026-04-08

### Added

- increase default max_results from 5 to 8

### Fixed

- format changelog to make linter happy

## [0.4.1] - 2026-04-08

### Changed

- update Pi deps to v0.66.0

### Fixed

- sanitize provider errors to prevent credential leakage

## [0.4.0] - 2026-04-08

### Added

- add semantic release to automate releases

### Fixed

- forward abort signal, clean temp files, warn on missing API key

## [0.3.1] - 2026-04-06

### Changed

- bump Pi deps to latest

### Fixed

- include paygo into status percentage calculation

## [0.3.0] - 2026-04-05

### Added

- add Tavily quota usage to footer
- CI workflow for Pi
- add CHANGELOG.md

## [0.2.0] - 2026-04-05

### Added

- add `web_extract` tool for extracting raw content from URLs using Tavily

## [0.1.2] - 2026-04-05

### Changed

- split web search execute function

## [0.1.1] - 2026-04-05

### Changed

- bump version to v0.1.1 to test NPM publishing workflow

## [0.1.0] - 2026-04-05

### Added

- Initial release with `web_search` tool using Tavily

[unreleased]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.8...HEAD
[0.5.8]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.7...v0.5.8
[0.5.7]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.6...v0.5.7
[0.5.6]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.5...v0.5.6
[0.5.5]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.4...v0.5.5
[0.5.4]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.3.1...v0.4.0
[0.4.0]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.1.2...v0.2.0
[0.1.2]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/shaftoe/pi-tavily-tools/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/shaftoe/pi-tavily-tools/releases/tag/v0.1.0
