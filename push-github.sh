#!/bin/bash
VERSION=$(node -p "require('./package.json').version")
git add .
git commit -m "v$VERSION"
git push origin main
git tag "v$VERSION"
git push origin "v$VERSION"
echo "✅ GitHub — v$VERSION live"
