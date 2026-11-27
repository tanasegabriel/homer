#!/bin/sh
set -eu

: "${IMAGE:?set IMAGE to the image to test}"

container=$(docker run --detach --publish 127.0.0.1::8080 "$IMAGE")
trap 'docker rm --force "$container" >/dev/null' EXIT

fail() {
  docker logs "$container" >&2
  echo "$1" >&2
  exit 1
}

status=starting
for _ in $(seq 30); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$container")
  [ "$status" = healthy ] && break
  sleep 1
done
[ "$status" = healthy ] || fail "Container is $status"

base="http://$(docker port "$container" 8080/tcp | head -n 1)"

curl --fail --silent --show-error --output /dev/null "$base/" || fail "/ did not load"
curl --fail --silent --show-error --output /dev/null "$base/assets/config.yml" || fail "No default config.yml"

version=$(curl --fail --silent --show-error "$base/VERSION") || fail "/VERSION did not load"
expected=$(jq -r .version package.json)
[ "$version" = "$expected" ] || fail "VERSION is $version, package.json says $expected"

uid=$(docker exec "$container" id -u)
[ "$uid" = 1000 ] || fail "Runs as uid $uid, not 1000"

echo "$IMAGE $version: healthy, serving, uid $uid"
