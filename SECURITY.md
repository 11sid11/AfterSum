# Security Policy

AfterSum stores financial data locally in the user's browser. Security and privacy reports are therefore taken seriously even though the project has no application backend.

## Supported version

The current `main` branch and the version deployed at GitHub Pages are the supported release line. AfterSum includes an in-app PWA update prompt so users can move to the latest deployed app shell without reinstalling or clearing browser data.

## Reporting a vulnerability

Please do **not** publish exploit details, real backups, or personal financial data in a public issue.

For a suspected security vulnerability:

1. Prefer GitHub's private vulnerability reporting for this repository when it is available.
2. Otherwise contact the repository maintainer privately through their GitHub profile with a minimal reproduction and impact description.
3. Use synthetic data only.

For ordinary non-sensitive bugs, use the public bug-report issue template.

## Useful context for reports

Include, where relevant:

- browser and version;
- installed PWA vs normal browser tab;
- operating system;
- whether the issue reproduces offline;
- exact steps using synthetic records;
- whether IndexedDB, service-worker cache, backup/restore, or file sharing is involved.

## Security model

- Financial records are stored in IndexedDB in the browser.
- There is no required AfterSum account or application backend.
- Portable backups and exports leave the device only when the user explicitly shares or saves them.
- The native share sheet is controlled by the operating system; AfterSum does not learn which destination the user chooses.
- Privacy Mode hides amounts on screen but is not authentication or encryption.
- Browser storage is origin-scoped, not path-scoped. Hosting sensitive applications on a dedicated origin is stronger isolation than sharing an origin with unrelated web applications.

## Out of scope

Reports that require a compromised operating system, malicious browser extension, or full access to the user's unlocked browser profile are generally outside the app's threat boundary, though concrete mitigations are still welcome.
