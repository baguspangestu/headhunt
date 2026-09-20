# Contributing

Thank you for helping improve Headhunt.

## Contribution workflow

Contributions target the `main` branch through a pull request. Do not work
directly on `main`.

1. Fork the repository on GitHub.
2. Clone your fork and add the main repository as `upstream`:

   ```bash
   git clone https://github.com/YOUR_USERNAME/headhunt.git
   cd headhunt
   git remote add upstream https://github.com/baguspangestu/headhunt.git
   ```

3. Update your local `main` and create a focused branch:

   ```bash
   git switch main
   git pull --ff-only upstream main
   git switch -c fix/short-description
   ```

4. Commit the change, push the branch to your fork, and open a pull request
   against `baguspangestu/headhunt:main`.

Use a descriptive branch prefix:

- `feat/` for a new feature.
- `fix/` for a bug fix.
- `docs/` for documentation only.
- `refactor/` for behavior-preserving code changes.
- `test/` for test changes.
- `chore/` for maintenance and tooling.

Use concise commit messages such as `fix: validate imported server IDs`. Keep
unrelated changes in separate pull requests.

## Development setup

1. Install Node.js 22 or newer.
2. Run `npm ci`.
3. Copy `.dev.vars.example` to `.dev.vars` and provide your own development
   configuration. Never commit local environment files or credentials.
4. Run `npm run dev`.

Each fork must use its own Google OAuth client and authorized origins. Import
URLs are sensitive and must never be used as fixtures or shared in reports.

## Before opening a pull request

Run:

```bash
npm run check
npm run build
```

Pull requests must pass the `quality` CI check before they can be merged. In the
pull request description:

- Explain the problem and the chosen solution.
- Link the related issue when one exists.
- Include screenshots for visible UI changes on desktop and mobile.
- Describe how the change was tested.
- Confirm that no credentials, Import URLs, or private user data are included.

Maintainers may request changes to keep behavior, design, localization, and
project structure consistent. Update tests and documentation whenever behavior
changes, and do not commit generated build output.

## Security and third-party material

Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
Never disclose a vulnerability or credential in an issue or pull request.

Third-party game assets and data are not covered by the MIT License. Document
the origin and permitted use of any third-party material added by a change.

By contributing, you agree that your source-code contribution is provided under
the repository's MIT License and that you will follow the
[Code of Conduct](CODE_OF_CONDUCT.md).
