#!/bin/bash
set -e

# Foundry Development Environment Setup
# This script clones/updates foundry-golden and prepares the dev environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MCP_DIR="$(dirname "$SCRIPT_DIR")"
GOLDEN_DIR="${FOUNDRY_GOLDEN_PATH:-$(dirname "$MCP_DIR")/foundry-golden}"

echo "Setting up Foundry development environment..."
echo "MCP repo: $MCP_DIR"
echo "Golden repo: $GOLDEN_DIR"
echo ""

# Clone or update golden repo
if [ ! -d "$GOLDEN_DIR" ]; then
  echo "Cloning foundry-golden..."
  git clone https://github.com/Now-AI-Foundry/foundry-golden.git "$GOLDEN_DIR"
else
  echo "Golden repo exists, pulling latest..."
  cd "$GOLDEN_DIR" && git pull --ff-only || echo "Warning: Could not pull latest (may have local changes)"
fi

echo ""

# Install MCP dependencies
cd "$MCP_DIR"
echo "Installing dependencies..."
npm install

# Build
echo "Building MCP server..."
npm run build

echo ""
echo "=========================================="
echo "Setup complete!"
echo "=========================================="
echo ""
echo "Run tests with:"
echo "  npm test"
echo ""
echo "Or with a custom golden repo path:"
echo "  FOUNDRY_GOLDEN_PATH=/path/to/golden npm test"
