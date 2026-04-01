#!/bin/bash
# ═══════════════════════════════════════
# Deploy Site X-Ray to Hetzner server
# Sets up the self-improving pipeline
#
# Usage: ./improve/deploy-hetzner.sh <server-ip> [ssh-key]
# ═══════════════════════════════════════

SERVER=$1
KEY=${2:-"~/.ssh/id_rsa"}

if [ -z "$SERVER" ]; then
  echo "Usage: ./improve/deploy-hetzner.sh <server-ip> [ssh-key]"
  exit 1
fi

echo "🚀 Deploying Site X-Ray to $SERVER..."

# Install dependencies on server
ssh -i "$KEY" root@$SERVER << 'REMOTE'
  # System
  apt-get update -y && apt-get install -y git python3 curl

  # Node.js 20
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi

  # pnpm
  npm install -g pnpm

  # Playwright browsers
  npx playwright install --with-deps chromium

  # Claude Code CLI
  if ! command -v claude &>/dev/null; then
    npm install -g @anthropic-ai/claude-code
    echo ""
    echo "⚠️  Claude Code installed. You need to authenticate:"
    echo "   Run: claude login"
    echo "   This is a one-time setup using your subscription."
    echo ""
  fi

  # Create project directory
  mkdir -p /opt/site-xray
REMOTE

# Sync project files
echo "📦 Syncing files..."
rsync -avz --exclude='node_modules' --exclude='test/results' --exclude='.git' \
  -e "ssh -i $KEY" \
  /Users/macintoshi/projects/site-xray/ root@$SERVER:/opt/site-xray/

# Install npm deps on server
ssh -i "$KEY" root@$SERVER << 'REMOTE'
  cd /opt/site-xray
  npm install playwright
  npx playwright install chromium

  echo ""
  echo "═══════════════════════════════════════"
  echo "  ✅ Site X-Ray deployed to $(hostname)"
  echo ""
  echo "  To run manually:"
  echo "    cd /opt/site-xray"
  echo "    node v13-stable.js https://example.com /tmp/test 5"
  echo ""
  echo "  To run improvement cycle:"
  echo "    cd /opt/site-xray"
  echo "    ./improve/cycle.sh --auto"
  echo ""
  echo "  To set up cron (every 6 hours):"
  echo "    crontab -e"
  echo "    0 */6 * * * cd /opt/site-xray && ./improve/cycle.sh --auto --notify >> /var/log/xray-improve.log 2>&1"
  echo ""
  echo "  ⚠️  First run: claude login"
  echo "═══════════════════════════════════════"
REMOTE
