#!/usr/bin/env bash
# Repo-specific checks that no off-the-shelf linter covers. Exits non-zero on any hit.
set -u
status=0

# Test helper types live in app/test/setup.ts. Import them; never re-derive them.
if grep -rn --include='*.ts' --include='*.tsx' 'ReturnType<typeof createTestDb>' app | grep -v '^app/test/setup.ts:'; then
  echo 'error: import `TestDb` from "~/test/setup" instead of re-deriving it.' >&2
  status=1
fi

exit $status
