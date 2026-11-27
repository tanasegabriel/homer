# Dummy data

This directory holds sample API responses, so smart cards can be developed and tested without running the real services. `demo.yml` lists every card, each pointed at its sample.

## See every card

```sh
pnpm demo
```

This starts the development server with `demo.yml` as the configuration.

## How to add a new services sample

- create a lowercase directory for your service (`AdGuardHome.vue` → `adguardhome/`), and any sub-folder existing in the service api path.
- save the api output in a file named after the service endpoint.
- an endpoint ending in `/`, or a path other samples nest under, is a directory holding an `index.html`.
- an XML-RPC call is served from `<path>/<methodName>` (see `rtorrent/RPC2/`).
- add the card to `demo.yml`.

Example:

```sh
mkdir pihole
curl http://my-pihole.me/admin/api.php -o pihole/api.php # /admin is omitted because for PiHole, the implementation expect it to be in the base url (`url` or `endpoint` property)
```

`pnpm mock` still serves this directory on its own port for `GET` requests, for configurations that point at it.
