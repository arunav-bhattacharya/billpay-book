#!/usr/bin/env bash
#
# Start the Billpay Wiki dev server.
#
# One command, run from anywhere in the repo. It picks the Node version pinned
# in website/.nvmrc, installs dependencies if they are missing, clears a stale
# dev server off the port, and starts Docusaurus with hot reload.
#
#   ./start.sh
#
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$REPO/website"
PORT=3100
URL="http://localhost:$PORT/billpay-book/"

cd "$SITE"

# --- Node ------------------------------------------------------------------
# .nvmrc pins the version. nvm is a shell function, so it is not on PATH in a
# non-interactive shell; source it here rather than asking anyone to remember
# `nvm use` first.
NVM_SH="${NVM_DIR:-$HOME/.nvm}/nvm.sh"
if [ -s "$NVM_SH" ]; then
  # shellcheck disable=SC1090
  . "$NVM_SH"
  nvm use --silent >/dev/null 2>&1 || nvm install >/dev/null
fi

if ! command -v node >/dev/null 2>&1; then
  echo "No node on PATH. Install Node $(cat .nvmrc), or nvm, and try again." >&2
  exit 1
fi

# On Apple Silicon an x64 Node installs x64-only native bindings, and the build
# then fails on a missing binding for the arch actually running.
if [ "$(uname -m)" = "arm64" ] && [ "$(node -p process.arch)" != "arm64" ]; then
  echo "Node is $(node -p process.arch) on an arm64 Mac ($(command -v node))." >&2
  echo "Use the arm64 Node from nvm: nvm install $(cat .nvmrc) && nvm use" >&2
  exit 1
fi

# --- Port ------------------------------------------------------------------
# An earlier dev server that was killed off badly, or one left running by
# another editor window, keeps the port and Docusaurus refuses to start.
pid="$(lsof -nP -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | head -1 || true)"
if [ -n "$pid" ]; then
  holder_cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  case "$holder_cwd" in
    "$REPO"|"$SITE"|"$REPO"/*)
      echo "Stopping the dev server already on port $PORT (pid $pid)."
      kill "$pid" 2>/dev/null || true
      for _ in 1 2 3 4 5; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 1
      done
      kill -9 "$pid" 2>/dev/null || true
      ;;
    *)
      echo "Port $PORT is held by pid $pid ($(ps -p "$pid" -o comm= 2>/dev/null))," >&2
      echo "which is not this repo. Nothing was stopped. Free the port, or change" >&2
      echo "the port in website/package.json, then run this again." >&2
      exit 1
      ;;
  esac
fi

# --- Dependencies ----------------------------------------------------------
# The test is for the `docusaurus` bin, not for a package directory. A tree
# can hold every dependency and still be missing node_modules/.bin, which is
# what `npm start` actually calls, and the failure then reads as the unhelpful
# "sh: docusaurus: command not found".
if [ ! -x node_modules/.bin/docusaurus ]; then
  echo "Dependencies are missing or incomplete. Installing (npm ci)."
  npm ci
fi

echo "Starting the wiki at $URL"
exec npm start
