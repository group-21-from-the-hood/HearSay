# HearSay

Deploy (Debian 13 + Docker)

- DNS
  - Create A record: hear-say.xyz -> your droplet public IP.

- Server prep
  - SSH: ssh root@your.ip
  - Install Docker + Compose:
    - apt update && apt install -y ca-certificates curl gnupg
    - install docker repo per docs.docker.com/engine/install/debian
    - apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - Firewall (optional):
    - ufw allow OpenSSH
    - ufw allow 80
    - ufw allow 443
    - ufw enable

- App setup
  - git clone https://github.com/your/repo.git && cd repo
  - Edit hearsay/.env:
    - Set API_ORIGIN=https://hear-say.xyz,http://localhost,http://127.0.0.1
    - Set SESSION_SECRET to a strong random
    - Ensure GOOGLE_/SPOTIFY_ vars are present
  - Update Google Cloud OAuth:
    - Authorized JavaScript origins: https://hear-say.xyz
    - Authorized redirect URIs: https://hear-say.xyz/auth/callback

- Run
  - docker compose up -d --build
  - Validate: curl http://hear-say.xyz/api/health (should return { ok: true })
  - App: open http://hear-say.xyz

- HTTPS (pick one)
  - Cloudflare proxy “Full” and SSL certs managed by Cloudflare.
  - Or install a reverse proxy (Caddy/Traefik) to terminate TLS on 443 and forward to frontend:80.
  - Or extend compose with a certbot-enabled nginx; ensure ports 80/443, and mount certs.

Notes
- Frontend serves on port 80 via nginx and proxies /api to backend.
- Backend listens on 5174 internally; not required to be internet-exposed.
- MongoDB is not published to the internet (recommended).