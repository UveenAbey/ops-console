#!/usr/bin/env pwsh
# Deploy all missing files to server

$server = "spectre@192.168.1.58"

Write-Host "Copying files to server..." -ForegroundColor Cyan

# Copy updated server.js
scp c:\xspectre-ops-console\cloud\api\server.js ${server}:/opt/xspectre/cloud/api/server.js

# Copy all frontend files
Write-Host "Copying frontend files..." -ForegroundColor Cyan
scp -r c:\xspectre-ops-console\cloud\web ${server}:/opt/xspectre/cloud/

# Copy deployment script
scp c:\xspectre-ops-console\cloud\deploy-frontend.sh ${server}:/opt/xspectre/cloud/deploy-frontend.sh

Write-Host "Making script executable and running deployment..." -ForegroundColor Cyan
ssh ${server} "chmod +x /opt/xspectre/cloud/deploy-frontend.sh && /opt/xspectre/cloud/deploy-frontend.sh"

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Access UI at: http://192.168.1.58:3000" -ForegroundColor Green
