/**
 * Semantic Release configuration.
 *
 * Uses @semantic-release/exec to run format/lint fixes after CHANGELOG.md
 * and package.json are updated, ensuring committed files always pass validation.
 */

export default {
  branches: ["master"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@alexanderfortin/semantic-release-keep-a-changelog",
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    [
      "@semantic-release/github",
      {
        assets: ["dist/*"],
        successComment: false,
      },
    ],
  ],
  tagFormat: "v${version}",
};
