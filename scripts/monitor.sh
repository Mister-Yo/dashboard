#!/bin/bash
# Coordinator Monitor — polls for new messages every 60 seconds
# Usage: ./scripts/monitor.sh

API="http://134.209.162.250"
LAST_COUNT=0
INTERVAL=60

echo "🔍 Monitoring coordinator at $API"
echo "   Checking every ${INTERVAL}s. Press Ctrl+C to stop."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

while true; do
  TIMESTAMP=$(date '+%H:%M:%S')

  # Check health
  HEALTH=$(curl -s --max-time 5 "$API/health" 2>/dev/null)
  if [ $? -ne 0 ]; then
    echo "[$TIMESTAMP] ❌ Server unreachable"
    sleep $INTERVAL
    continue
  fi

  # Get messages
  MESSAGES=$(curl -s --max-time 5 "$API/api/coord/messages" 2>/dev/null)
  COUNT=$(echo "$MESSAGES" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  # Get agents
  AGENTS=$(curl -s --max-time 5 "$API/api/coord/agents" 2>/dev/null)
  AGENT_LIST=$(echo "$AGENTS" | python3 -c "
import sys,json
agents = json.load(sys.stdin)
for a in agents:
    print(f\"  {a['name']:10s} | {a['status']:8s} | {','.join(a.get('specialization_codes',[]))}\")
" 2>/dev/null)

  if [ "$COUNT" -gt "$LAST_COUNT" ] && [ "$LAST_COUNT" -gt 0 ]; then
    NEW=$((COUNT - LAST_COUNT))
    echo ""
    echo "[$TIMESTAMP] 🔔 $NEW NEW MESSAGE(S)!"
    echo "$MESSAGES" | python3 -c "
import sys,json
msgs = json.load(sys.stdin)
for m in msgs[-$NEW:]:
    sender = m.get('sender_id','?')
    text = m.get('payload',{}).get('text','')[:200]
    ts = m.get('created_at','')[:19]
    print(f'  📨 [{sender}] {ts}')
    print(f'     {text}')
    print()
" 2>/dev/null
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  else
    echo "[$TIMESTAMP] ✅ Server OK | Messages: $COUNT | Agents:"
    echo "$AGENT_LIST"
  fi

  LAST_COUNT=$COUNT
  sleep $INTERVAL
done
