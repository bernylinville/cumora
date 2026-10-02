# VPS self-host image

The `bernylinville/cumora` fork builds the upstream API and React SPA into one Linux amd64 image using `server/docker/cumora-server.Dockerfile`. No credentials or local `.env` files are part of the build context.

## Build and publish

- `.github/workflows/ghcr.yml` builds and typechecks pull requests without publishing.
- A push to `main` publishes `ghcr.io/bernylinville/cumora-server:sha-<full-commit>` using the workflow's `GITHUB_TOKEN`.
- Make the GHCR package public after its first publication so the VPS and Molecule CI can pull without registry credentials.
- Pin the immutable `@sha256:...` reference from the workflow summary in a separate `vps-ansible` PR and validate it with Molecule. Do not deploy by tag.
- The fork's upstream GCP, desktop release, npm publish, and Cloudflare workflows are disabled in GitHub Actions. They are not part of this VPS deployment. The upstream PR checks and the self-host GHCR workflow remain enabled.

## Automated upstream proposals

`.github/workflows/check-upstream.yml` checks `yetone/cumora:main` daily at 01:17 UTC, or when manually dispatched. If the fork already contains every upstream commit it does nothing. Otherwise it opens one cross-fork PR from `yetone:main` into this fork's `main`, reusing an existing open PR rather than duplicating it. It never force-syncs a branch, approves a PR, or merges one.

Merge an upstream proposal using **Create a merge commit**, not squash/rebase. Preserving upstream ancestry prevents the next check from proposing commits that were already imported, and GitHub's normal merge preserves fork-only files such as `ghcr.yml`. Resolve conflicts and review migrations/OAuth/BYOA compatibility before merging; do not reset this fork to upstream.

The automation uses only its repository `GITHUB_TOKEN`, with read access to contents and write access to pull requests. Enable **Allow GitHub Actions to create and approve pull requests** in the repository's Actions settings; this workflow creates PRs but never approves them. GitHub currently puts CI triggered by a `GITHUB_TOKEN`-created PR into an approval-required state. A maintainer must click **Approve workflows to run** and wait for all checks to pass before merging; missing or unapproved checks are not a pass. No personal PAT is stored in Actions.

After a source PR is merged, the existing main build publishes its immutable image. The infrastructure repository's **Check Cumora Image** workflow checks for a successful build and proposes a separate digest update. That PR runs Molecule before deployment; an upstream merge alone does not upgrade the VPS. Check workflows may be dispatched manually for an immediate check; they do not add a manual image-publication path.

## Deployment contract

The [vps-ansible Cumora role](https://github.com/bernylinville/vps-ansible/tree/main/roles/cumora) manages Docker Compose. PostgreSQL 18 with pgvector is the durable boundary; Redis is transient. The server serves the SPA, API, uploads, and WebSockets through a single Traefik HTTPS origin. Cloud agent Pods require Kubernetes and are not provided by this deployment; pair a computer using BYOA instead.

For a new image, start the database and Redis, run the **same image's** `npm run migrate` as a one-off command, then start the server. The server only verifies the schema on boot. A migration failure must stop deployment before replacing the server. Back up PostgreSQL before upgrades: reverting the image alone is not a database rollback.

Runtime secrets are encrypted with Ansible Vault in the infrastructure repository. GitHub OAuth requires its registered callback to match `https://<host>/api/auth/callback/github`. Web login and BYOA must be configured for the self-host origin rather than the upstream `app.cumora.ai` or `api.cumora.ai` endpoints.
