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

## Open firewall for 80/443 on Debian 13

Option A: UFW (simple)
- apt update && apt install -y ufw
- ufw allow OpenSSH
- ufw allow 80/tcp
- ufw allow 443/tcp
- ufw enable
- ufw status verbose

Option B: firewalld
- apt update && apt install -y firewalld
- systemctl enable --now firewalld
- firewall-cmd --permanent --add-service=http
- firewall-cmd --permanent --add-service=https
- firewall-cmd --reload
- firewall-cmd --list-all

DigitalOcean Cloud Firewall (if used)
- In the DO control panel, create/modify a firewall for the droplet:
  - Inbound rules: TCP 22 (SSH), TCP 80 (HTTP), TCP 443 (HTTPS).
  - Outbound: allow all (default).

Notes
- Frontend serves on port 80 via nginx and proxies /api to backend.
- Backend listens on 5174 internally; not required to be internet-exposed.
- MongoDB is not published to the internet (recommended).
- Docker publishes ports even with UFW; to restrict exposure, prefer DO Cloud Firewall or add rules in the DOCKER-USER iptables chain.
- After opening, verify:
  - curl http://your-server-ip
  - curl http://hear-say.xyz/api/health

## Troubleshooting 502 on droplet
- Confirm containers: docker ps
- Backend healthy: docker logs hearsay_backend | grep health
- From frontend container: docker exec -it hearsay_frontend sh -c "curl -v backend:5174/api/health"
  - If connection refused: backend not on same network or crashed.
- If CORS errors in browser and IP origin not allowed, add droplet IP to API_ORIGIN in hearsay/.env, rebuild.
- Rebuild clean: docker compose down -v && docker compose up --build
- Check nginx error log: docker exec -it hearsay_frontend sh -c "grep -i error /var/log/nginx/error.log || echo no errors"