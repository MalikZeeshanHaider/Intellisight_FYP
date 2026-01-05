#!/bin/bash
# Test Daily Reset Functionality

echo "========================================"
echo "  IntelliSight Daily Reset Test"
echo "========================================"
echo ""

# Check if backend is running
echo "[1/4] Checking backend health..."
HEALTH=$(curl -s http://localhost:3000/api/health)
if [[ $HEALTH == *"success"* ]]; then
  echo "✓ Backend is healthy"
else
  echo "✗ Backend is not running!"
  exit 1
fi

echo ""
echo "[2/4] Getting daily statistics..."
STATS=$(curl -s http://localhost:3000/api/daily-reset/statistics)
echo "$STATS" | python -c "import sys, json; data=json.load(sys.stdin); print(f'Today: {data.get(\"data\", {}).get(\"today\", 0)} | Last 7 Days: {data.get(\"data\", {}).get(\"last7Days\", 0)} | Active: {data.get(\"data\", {}).get(\"currentActive\", 0)}')" 2>/dev/null || echo "$STATS"

echo ""
echo "[3/4] Checking active presence..."
ACTIVE=$(curl -s http://localhost:3000/api/live-recognition/active)
COUNT=$(echo "$ACTIVE" | python -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('data', {}).get('active', [])))" 2>/dev/null || echo "?")
echo "✓ Currently $COUNT people in zones"

echo ""
echo "[4/4] Testing manual reset (commented out - use with caution)"
echo "# To manually trigger reset:"
echo "# curl -X POST http://localhost:3000/api/daily-reset/manual"

echo ""
echo "========================================"
echo "  Test Complete!"
echo "========================================"
echo ""
echo "Daily reset will automatically run at midnight (00:00)"
echo "Check server logs for: 'Triggered scheduled daily reset'"
