# VPS self-host image

The `bernylinville/cumora` fork builds the upstream API and React SPA into one Linux amd64 image using `server/docker/cumora-server.Dockerfile`. No credentials or local `.env` files are part of the build context.

## Build and publish

- `.github/workflows/ghcr.yml` builds and typechecks pull requests without publishing.
- A push to `main` publishes `ghcr.io/bernylinville/cumora-server:sha-<full-commit>` using the workflow's `GITHUB_TOKEN`.
- Make the GHCR package public after its first publication so the VPS and Molecule CI can pull without registry credentials.
- Pin the immutable `@sha256:...` reference from the workflow summary in a separate `vps-ansible` PR and validate it with Molecule. Do not deploy by tag.
- The fork's upstream GCP, desktop release, npm publish, and Cloudflare workflows are disabled in GitHub Actions. They are not part of this VPS deployment. The upstream PR checks and the self-host GHCR workflow remain enabled.

## Deployment contract

The [vps-ansible Cumora role](https://github.com/bernylinville/vps-ansible/tree/main/roles/cumora) manages Docker Compose. PostgreSQL 18 with pgvector is the durable boundary; Redis is transient. The server serves the SPA, API, uploads, and WebSockets through a single Traefik HTTPS origin. Cloud agent Pods require Kubernetes and are not provided by this deployment; pair a computer using BYOA instead.

For a new image, start the database and Redis, run the **same image's** `npm run migrate` as a one-off command, then start the server. The server only verifies the schema on boot. A migration failure must stop deployment before replacing the server. Back up PostgreSQL before upgrades: reverting the image alone is not a database rollback.

Runtime secrets are encrypted with Ansible Vault in the infrastructure repository. GitHub OAuth requires its registered callback to match `https://<host>/api/auth/callback/github`. Web login and BYOA must be configured for the self-host origin rather than the upstream `app.cumora.ai` or `api.cumora.ai` endpoints.
