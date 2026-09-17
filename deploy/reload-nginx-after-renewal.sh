#!/bin/sh
set -eu

# Certbot deploy hook: apply a renewed certificate to the shared Nginx container.
docker exec levelup_nginx nginx -t
docker exec levelup_nginx nginx -s reload
