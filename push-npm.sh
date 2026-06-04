#!/bin/bash

VERSION=$(node -p "require('./package.json').version")

echo "🚀 About to publish @ailink/sdk v$VERSION to npm"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Cancelled."
  exit 0
fi

echo "📦 Building..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed. Fix errors before publishing."
  exit 1
fi

npm publish --access public

if [ $? -ne 0 ]; then
  echo "❌ Publish failed. Check npm login status: npm whoami"
  exit 1
fi

echo "✅ npm — @ailink/sdk v$VERSION is live"
echo "📦 https://www.npmjs.com/package/@ailink/sdk"
