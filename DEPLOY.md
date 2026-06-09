# Deploying to Unraid

## First time setup

1. Copy the project folder to Unraid:
   ```
   /mnt/user/appdata/macro-tracker/
   ```

2. Create a `.env` file in that folder:
   ```
   ANTHROPIC_API_KEY=your_key_here
   PORT=3000
   ```

3. Build and start:
   ```bash
   docker build -t macro-tracker .
   docker run -d \
     --name macro-tracker \
     --restart unless-stopped \
     -p 3052:3000 \
     -v /mnt/user/appdata/macro-tracker/data:/app/data \
     --env-file /mnt/user/appdata/macro-tracker/.env \
     macro-tracker
   ```

4. Open the app at `http://<unraid-tailscale-ip>:3052`
   - Find your Tailscale IP with: `tailscale ip -4`

---

## Updating the app

1. Copy the updated files to `/mnt/user/appdata/macro-tracker/` on Unraid

2. Rebuild and restart:
   ```bash
   cd /mnt/user/appdata/macro-tracker
   docker stop macro-tracker
   docker rm macro-tracker
   docker build -t macro-tracker .
   docker run -d \
     --name macro-tracker \
     --restart unless-stopped \
     -p 3052:3000 \
     -v /mnt/user/appdata/macro-tracker/data:/app/data \
     --env-file /mnt/user/appdata/macro-tracker/.env \
     macro-tracker
   ```

3. Check it's running:
   ```bash
   docker ps
   ```

Your food journal data is safe in `./data/` and is never affected by updates.

---

## Useful commands

| Command | What it does |
|---------|--------------|
| `docker ps` | Check the container is running |
| `docker logs macro-tracker` | View app logs / errors |
| `docker stop macro-tracker` | Stop the app |
| `docker start macro-tracker` | Start it again |
| `docker restart macro-tracker` | Restart it |
