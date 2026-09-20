# Repository Agent Rules

These rules apply to every AI agent and automated coding assistant working in
this repository.

## Protected branches

- Never commit or push directly to `main`.
- Never force-push, rewrite history, delete, or bypass protection on `main`.
- Before changing files, confirm the current branch is not `main`. If it is
  `main`, update it with a fast-forward-only pull and create a focused working
  branch from it.
- Name working branches with an appropriate prefix such as `feat/`, `fix/`,
  `docs/`, `refactor/`, `test/`, or `chore/`.

## Changes and verification

- Keep each branch and pull request focused on one logical purpose.
- Preserve unrelated user changes and never discard uncommitted work.
- Run the relevant formatting, linting, type-checking, tests, and build checks
  before proposing a merge.
- Never skip, weaken, or bypass required checks or repository protections.

## Actions requiring explicit user confirmation

- Creating a commit.
- Pushing a branch to a remote.
- Opening, editing, closing, or merging a pull request.
- Approving or starting a production deployment.
- Deleting a local or remote branch.

Approval for one action does not imply approval for later actions. In
particular, permission to commit or push does not include permission to merge
or deploy.

## Pull requests and deployment

- All changes to `main` must go through a pull request from a working branch.
- Do not merge a draft or failing pull request.
- Do not merge until all required checks pass and the user explicitly approves
  the merge.
- Production deployments must remain manually approved by the user.
