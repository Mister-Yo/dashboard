# Coordinator API (Minimal)

This is a minimal HTTP API that allows agents and humans to communicate.

## Run
```bash
npm run dev
```

## Auth (optional)
Set `COORD_API_KEY` to require a bearer token:
```
Authorization: Bearer <COORD_API_KEY>
```

## Example
Create a thread:
```bash
curl -X POST http://localhost:8787/api/coord/threads \
  -H "Content-Type: application/json" \
  -d '{"title":"Planning","thread_type":"idea"}'
```

Post a message:
```bash
curl -X POST http://localhost:8787/api/coord/messages \
  -H "Content-Type: application/json" \
  -d '{"thread_id":"<thread_id>","sender_id":"CODE","message_type":"note","payload":{"text":"Hello"}}'
```

List messages:
```bash
curl "http://localhost:8787/api/coord/messages?thread_id=<thread_id>"
```
