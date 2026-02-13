#!/usr/bin/env pwsh
# Push to GitHub and deploy to server

Write-Host "=== Step 1: Pushing to GitHub ===" -ForegroundColor Cyan

cd c:\xspectre-ops-console

# Add all files
git add .

# Commit
git commit -m "Add missing route and job files"

# Push (using cached credentials or SSH key)
git push origin main 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed. Trying 'master' branch..." -ForegroundColor Yellow
    git push origin master 2>&1
}

Write-Host "`n=== Step 2: Deploying to server ===" -ForegroundColor Cyan

# Create deployment commands
$deployCommands = @"
cd /opt/xspectre
git pull
sudo systemctl restart xspectre-api
sleep 2
sudo systemctl status xspectre-api --no-pager
echo ''
echo 'Testing API...'
curl http://localhost:3000/health
"@

# Save to temp file
$deployCommands | Out-File -FilePath "c:\temp-deploy.sh" -Encoding UTF8 -NoNewline

# Copy script to server and execute
Write-Host "Copying deployment script to server..." -ForegroundColor Yellow
scp c:\temp-deploy.sh spectre@192.168.1.58:/tmp/deploy.sh

Write-Host "Executing deployment on server..." -ForegroundColor Yellow
ssh spectre@192.168.1.58 "bash /tmp/deploy.sh"

# Cleanup
Remove-Item c:\temp-deploy.sh -ErrorAction SilentlyContinue

Write-Host "`n=== Deployment Complete! ===" -ForegroundColor Green
Write-Host "Access your API at: http://192.168.1.58:3000/health" -ForegroundColor Green
