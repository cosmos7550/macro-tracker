# Macro Tracker

AI-powered calorie and macro tracker. Describe a meal in plain text estimates are given to calories, protein, carbs, and fat. Results are saved to a daily food journal.

[![Docker Hub](https://img.shields.io/docker/v/earful1751/macro-tracker?label=Docker%20Hub)](https://hub.docker.com/r/earful1751/macro-tracker)

<img src="public/apple-touch-icon.png" width="80" />

## Requirements

- [Anthropic API key](https://console.anthropic.com/)
- Node.js 18+ or Docker

## Setup

Copy `.env.example` to `.env` and add your API key:
   ```
   ANTHROPIC_API_KEY=your_key_here
   PORT=3000
   ```


## Docker

**Docker Compose:**
```bash
docker compose up -d
```

**Manual docker run (Unraid):**
```bash
docker run -d \
  --name macro-tracker \
  --restart unless-stopped \
  -p 3052:3000 \
  -v <path to store food journal data>:/app/data \
  --env <path to the env file> \
  earful1751/macro-tracker:latest
```

| Flag | Purpose |
|------|---------|
| `-p 3052:3000` | Exposes the app on port 3052 |
| `-v .../data:/app/data` | Persists your food journal outside the container |
| `--env-file` | Passes your API key without baking it into the image |
| `--restart unless-stopped` | Auto-starts the container after an Unraid reboot |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/estimate` | POST | Estimate macros for a food description |
| `/api/journal/:date` | GET/POST | Read or save a day's food journal |
| `/api/journal/dates` | GET | List all saved journal dates |
| `/api/goals/:date` | GET/POST | Read or save macro goals |

## Data

Journal and goals are stored as JSON files in `./data/`:
- `journal_YYYY-MM-DD.json` — daily food entries
- `goals_YYYY-MM-DD.json` — macro targets (looks up most recent goal if no exact match)
