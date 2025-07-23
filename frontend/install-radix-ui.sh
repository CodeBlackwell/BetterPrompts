#!/bin/bash

# Install missing Radix UI components for the profile page
echo "Installing missing Radix UI components..."

cd "$(dirname "$0")"

# Install Avatar and Separator components
npm install @radix-ui/react-avatar @radix-ui/react-separator

echo "✅ Radix UI components installed successfully!"
echo ""
echo "The following components were installed:"
echo "- @radix-ui/react-avatar (for user avatars)"
echo "- @radix-ui/react-separator (for visual separators)"
echo ""
echo "You can now use the profile page at /profile"