# Security Policy

## Supported versions

Only the latest release is supported. Fixes land there rather than being backported to older versions, so please reproduce against it before reporting.

## Reporting a vulnerability

Please report privately through [GitHub Security Advisories](https://github.com/homer-dashboard/homer/security/advisories/new), not in a public issue.

Useful things to include: the Homer version, how it is deployed (Docker image or release zip), and the smallest `config.yml` that reproduces it.

Homer is maintained in spare time. You will get an acknowledgement and an honest assessment, but no guaranteed response time. If a report turns out to be valid, you will be credited in the advisory unless you would rather not be.

## Known, and by design

These are documented behaviour rather than vulnerabilities. Reports about them will be closed with a link back here.

**`config.yml` is public.** Homer runs in the browser, which downloads `/assets/config.yml` to draw the dashboard. Anything in it, API keys included, is readable by anyone who can open Homer. Put Homer behind authentication if a card carries a credential, or have a proxy add it on the server side. See the [smart cards warning](docs/customservices.md).

**`message.sanitize: false` trusts the endpoint.** The message's remote HTML is sanitized by default. Turning that off renders it as is, so whoever controls the endpoint can run code on your dashboard. See [the message options](docs/configuration.md).
