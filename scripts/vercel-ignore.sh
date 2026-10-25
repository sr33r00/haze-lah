#!/bin/sh
# Vercel's ignore step: exit 0 skips the build, anything else builds.
# Skip when nothing that ships changed since the last deploy: only data, scripts, .github, the Cloudflare Worker or docs.
[ -n "$VERCEL_GIT_PREVIOUS_SHA" ] &&
  git cat-file -e "$VERCEL_GIT_PREVIOUS_SHA" 2>/dev/null &&
  git diff --quiet "$VERCEL_GIT_PREVIOUS_SHA" HEAD -- . ':(exclude)data' ':(exclude)scripts' ':(exclude).github' ':(exclude)workers' ':(exclude)*.md' ':(exclude)LICENSE' ':(exclude)NOTICE'
