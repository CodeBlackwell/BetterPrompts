#!/bin/bash

# Phase 12 Test Setup Script
# This script sets up the environment for running mobile & accessibility tests

echo "🔧 Setting up Phase 12: Mobile & Accessibility Tests"
echo "=================================================="

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js 18+ is required (found: $(node -v))"
    exit 1
fi
echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Install Playwright browsers
echo ""
echo "🌐 Installing Playwright browsers..."
npx playwright install

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p test-results
mkdir -p playwright-report
mkdir -p reports

# Verify installation
echo ""
echo "🔍 Verifying installation..."

# Check if key packages are installed
if [ -d "node_modules/@playwright/test" ]; then
    echo "✅ Playwright installed"
else
    echo "❌ Playwright not found"
    exit 1
fi

if [ -d "node_modules/@axe-core/playwright" ]; then
    echo "✅ Axe-core installed"
else
    echo "❌ Axe-core not found"
    exit 1
fi

# Check TypeScript compilation
echo ""
echo "📝 Checking TypeScript..."
npx tsc --noEmit
if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Display test information
echo ""
echo "📋 Available test suites:"
echo "  - us-019-mobile-experience.spec.ts (Mobile Experience)"
echo "  - us-020-accessibility.spec.ts (Accessibility)"
echo "  - mobile-a11y-combined.spec.ts (Combined Tests)"

echo ""
echo "🚀 Setup complete! You can now run tests with:"
echo "  ./run-tests.sh          # Run all tests"
echo "  ./run-tests.sh mobile   # Run mobile tests only"
echo "  ./run-tests.sh a11y     # Run accessibility tests only"
echo "  npm run test:headed     # Run tests with browser visible"
echo ""
echo "=================================================="