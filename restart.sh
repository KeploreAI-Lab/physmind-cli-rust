#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/rust"
~/.cargo/bin/cargo install --path crates/rusty-claude-cli --quiet
exec claw "$@"
