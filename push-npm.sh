#!/bin/bash
VERSION=$(node -p "require('./package.json').version")
npm run build
npm publish --access public
echo "✅ npm — v$VERSION live"
