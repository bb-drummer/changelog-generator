# changelog-generator

simple generator for change-log file from git log, outputs in markdown and/or HTML

## install/update

```bash
$> npm install -g git+https://gitlab.bjoernbartels.earth/devops/changelog-generator.git
```

## usage

output log to `CHANGELOG.md` in current direcory
```bash
$> changelog-generator
```

also output log to HTML file in current direcory
```bash
$> changelog-generator --page="./changelog.html"
```

output log to console, *not* generating a file
```bash
$> changelog-generator --file=false
```

output log to console, in addition to generating a file
```bash
$> changelog-generator --output
```

output log for latest changes only
```bash
$> changelog-generator --latestonly
```

### link commits and Jira issues (optional)
 
add GitLab/BitBucket/... links for commit hashes
```bash
$> changelog-generator --link="<repo-commit-base-URL>"
```

add Jira links for detected Jira issue IDs, like "AB-1".."ABCDEF-12345678"
```bash
$> changelog-generator --jira="<jira-browse-base-URL>"
```

example with commit and issue links:

```bash
changelog-generator --link="https://gitlab.bjoernbartels.earth/devops/changelog-generator" --jira="https://jira.bjoernbartels.earth/browse"
```

## options

- `--file` : output markdown filename, default "./CHANGELOG.md", 'false' outputs to console overriding the `--output` and `--page` settings
- `--page` : output HTML filename, default "./changelog.html"
- `--link` : Gitlab/Bitbucket repository URL, respectively it's commits base-URL (optional)
- `--jira` : Jira issue browsing base-URL (optional)
- `--verbose` : extended log, show merged branches' sub commits, default: false
- `--latestonly` : generate log for latest changes only, default: false
- `--output` : output log to console, default: false
