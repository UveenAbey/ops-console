#!/bin/bash
# Build and deploy frontend to server

set -e

echo "========================================="
echo "Building and Deploying Frontend"
echo "========================================="

# Navigate to web directory
cd /opt/xspectre/cloud/web

# Install dependencies
echo "Installing dependencies..."
npm install

# Build for production
echo "Building frontend..."
npm run build

# Restart API service to serve new frontend
echo "Restarting API service..."
sudo systemctl restart xspectre-api

echo ""
echo "✅ Frontend deployed successfully!"
echo ""
echo "Access the UI at: http://192.168.1.58:3000"
echo ""
