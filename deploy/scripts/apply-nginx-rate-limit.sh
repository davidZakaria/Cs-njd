#!/usr/bin/env bash
set -euo pipefail

STAMP="$(date +%Y%m%d%H%M%S)"
cp /etc/nginx/nginx.conf "/etc/nginx/nginx.conf.bak.${STAMP}"

if ! grep -q 'zone=crm_limit' /etc/nginx/nginx.conf; then
  awk '/^http \{/ { print; print "\tlimit_req_zone $binary_remote_addr zone=crm_limit:10m rate=10r/s;"; next }1' \
    /etc/nginx/nginx.conf > /tmp/nginx.conf.new
  mv /tmp/nginx.conf.new /etc/nginx/nginx.conf
fi

sed -i 's/# server_tokens off;/server_tokens off;/' /etc/nginx/nginx.conf

for site in njd-crm.com cs-njd.duckdns.org; do
  file="/etc/nginx/sites-available/${site}"
  if [ ! -f "${file}" ]; then
    continue
  fi
  cp "${file}" "${file}.bak.${STAMP}"
  if ! grep -q 'limit_req zone=crm_limit' "${file}"; then
    awk '/location \/ \{/ { print; print "        limit_req zone=crm_limit burst=20 nodelay;"; next }1' \
      "${file}" > "/tmp/${site}.new"
    mv "/tmp/${site}.new" "${file}"
  fi
done

nginx -t
systemctl reload nginx
echo "NGINX_RATE_LIMIT_APPLIED"
