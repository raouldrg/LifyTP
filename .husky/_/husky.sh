#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  debug () {
    [ "${HUSKY_DEBUG}" = "1" ] && echo "husky (debug) - $1"
  }
  readonly hook_name="$(basename "$0")"
  debug "starting $hook_name..."
  . "$(dirname "$0")/husky.local.sh" 2>/dev/null || true
  export readonly husky_skip_init=1
  sh -e "$0" "$@"
  exitCode="$?"
  debug "done $hook_name, exitCode=$exitCode"
  exit $exitCode
fi
