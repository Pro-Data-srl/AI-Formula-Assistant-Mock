# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please **do not
open a public GitHub issue**. Instead, report it privately by email:

- **Contact:** info@prodata.it
- **Subject:** `[Security] AI-Formelassistent-Prototype – <short description>`

Please include:

- A description of the issue and its potential impact.
- Steps to reproduce (proof-of-concept, request samples, or code).
- The affected commit, branch, or release.
- Your name / handle if you would like to be credited.

We will acknowledge receipt within a reasonable time frame and keep you
informed about the progress of the fix.

## Scope

This repository is a **prototype**. It is published for research,
experimentation, and demonstration purposes under the
[PolyForm Noncommercial License 1.0.0](./LICENSE).

The HTTP API routes (`/api/chat`, `/api/conversations`) **do not include
authentication, authorization, or rate limiting** by design. Do not
deploy this code to a public environment without adding those controls.
Issues that depend solely on the absence of these controls in the
prototype will be considered known limitations rather than
vulnerabilities.
