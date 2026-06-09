# Macro Tracker

<img src="public/apple-touch-icon.png" width="80" />

AI-powered calorie and macro tracker. Describe a meal in plain text estimates are given to calories, protein, carbs, and fat. Results are saved to a daily food journal.

## Requirements

- [Anthropic API key](https://console.anthropic.com/)
- Node.js 18+ or Docker

## Setup

Copy `.env.example` to `.env` and add your API key:
   ```
   ANTHROPIC_API_KEY=your_key_here
   PORT=3000
   ```

Access via Tailscale: `http://<tailscale-ip>:3052`

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

## Dockerhub

[![Docker Hub](https://img.shields.io/docker/v/earful1751/macro-tracker?label=Docker%20Hub)](https://hub.docker.com/r/earful1751/macro-tracker)