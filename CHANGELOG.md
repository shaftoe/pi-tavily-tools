## [0.5.2](https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.1...v0.5.2) (2026-04-08)

### Performance Improvements

- add session-level result cache to avoid redundant extract calls ([#9](https://github.com/shaftoe/pi-tavily-tools/issues/9)) ([6fd1056](https://github.com/shaftoe/pi-tavily-tools/commit/6fd1056a4bdbb108d0df5923c996e6e169641999))

## [0.5.1](https://github.com/shaftoe/pi-tavily-tools/compare/v0.5.0...v0.5.1) (2026-04-08)

### Bug Fixes

- ensure release process create a clean changelog ([a75777d](https://github.com/shaftoe/pi-tavily-tools/commit/a75777ddc8a31b6357f478e27bb5092e9df9fef3))

# Changelog

All notable changes to this project will be documented in this file.

This project follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html) and
uses [semantic-release](https://semantic-release.gitbook.io/) for automated releases.
The format is based on [Keep a Changelog](https://keepachangelog.org/en/1.1.0/).

## [0.5.0](https://github.com/shaftoe/pi-tavily-tools/compare/v0.4.1...v0.5.0) (2026-04-08)

### Bug Fixes

- format changelog to make linter happy ([c7987f5](https://github.com/shaftoe/pi-tavily-tools/commit/c7987f547cc91d64475062dc22365311067e54e8))

### Features

- increase default max_results from 5 to 8 ([661a995](https://github.com/shaftoe/pi-tavily-tools/commit/661a9957911afcbd170d0318308a56f4653e8dc4))

## [0.4.1](https://github.com/shaftoe/pi-tavily-tools/compare/v0.4.0...v0.4.1) (2026-04-08)

### Bug Fixes

- sanitize provider errors to prevent credential leakage ([#7](https://github.com/shaftoe/pi-tavily-tools/issues/7)) ([792a0a2](https://github.com/shaftoe/pi-tavily-tools/commit/792a0a28dcfb8e82a2711db16c492769b1361504))

## [0.4.0](https://github.com/shaftoe/pi-tavily-tools/compare/v0.3.1...v0.4.0) (2026-04-08)

### Bug Fixes

- forward abort signal, clean temp files, warn on missing API key ([#6](https://github.com/shaftoe/pi-tavily-tools/issues/6)) ([d18529c](https://github.com/shaftoe/pi-tavily-tools/commit/d18529cc8c48ae1575e2405fd89e93233b4ddb7e))

### Features

- add semantic release to automate releases ([ae572b0](https://github.com/shaftoe/pi-tavily-tools/commit/ae572b0c2c2529e8b9abc2b70268390bb226aba8))

## [0.3.1] - 2026-04-06

### Changed

- fixed wrong calculation for status, now also includes paygo data
- bump Pi deps to latest

## [0.3.0] - 2026-04-05

### Added

- add Tavily quota usage to footer
- CI workflow for Pi
- add CHANGELOG.md (this file)

## [0.2.0] - 2026-04-05

### Added

- `web_extract` tool for extracting raw content from URLs using Tavily

## [0.1.2] - 2026-04-05

### Changed

- Refactor: split web search execute function

## [0.1.1] - 2026-04-05

### Changed

- Bump version to v0.1.1 to test NPM publishing workflow

## [0.1.0] - 2026-04-04

### Added

- Initial release with `web_search` tool using Tavily
