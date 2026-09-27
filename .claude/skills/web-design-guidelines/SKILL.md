---
name: web-design-guidelines
description: Review UI code for Web Interface Guidelines compliance. Use when asked to "review my UI", "check accessibility", "audit design", "review UX", or "check my site against best practices".
metadata:
  author: vercel
  version: "1.0.0"
  argument-hint: <file-or-pattern>
---

# Web Interface Guidelines

Review files for compliance with Web Interface Guidelines.

## How It Works

1. Read the pinned guidelines in `web-interface-guidelines.md` (in this skill's directory)
2. Read the specified files (or prompt user for files/pattern)
3. Check against all rules in the guidelines
4. Output findings in the terse `file:line` format

## Guidelines Source

The guidelines are vendored locally in `web-interface-guidelines.md`, next to this file. Do not fetch them from the network.

That file is a reviewed, pinned copy of `command.md` from https://github.com/vercel-labs/web-interface-guidelines at commit `e3d624baaf29dc1fc645aff3e38f03e564d2d6b1`. (Local modification: the upstream skill fetched `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` with WebFetch on every run. To update, review a newer revision and replace the file.)

The guidelines file contains all the rules and the output format.

## Usage

When a user provides a file or pattern argument:
1. Read `web-interface-guidelines.md`
2. Read the specified files
3. Apply all rules from the guidelines
4. Output findings using the format specified in the guidelines

If no files specified, ask the user which files to review.
