#!/bin/bash
# Move to the directory where this script is located
cd "$(dirname "$0")"

echo "Building and starting Electron app..."

# Explicitly add all known possible paths for Node/npm to ensure it works outside the editor
export PATH="/Users/ps/.gemini/antigravity-ide/bin:/opt/homebrew/bin:/usr/local/bin:/usr/local/n/versions/node/bin:$PATH"

# If using nvm, try to load it just in case
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if command -v npm >/dev/null 2>&1; then
    npm run electron:start
else
    echo "Error: Could not find npm on your system."
    echo "Current PATH: $PATH"
    sleep 10
fi
