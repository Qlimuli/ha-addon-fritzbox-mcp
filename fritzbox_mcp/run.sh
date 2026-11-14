#!/usr/bin/with-contenv bashio
set -e

HOST=$(bashio::config 'host')
USERNAME=$(bashio::config 'username')
PASSWORD=$(bashio::config 'password')
PORT=$(bashio::config 'port')

bashio::log.info "Starting FRITZ!Box MCP Server v1.2.0..."
bashio::log.info "Host: ${HOST}"
bashio::log.info "Port: ${PORT}"

if [ -z "${USERNAME}" ] || [ -z "${PASSWORD}" ]; then
  bashio::log.warning "Username or password not set. Configure the add-on options."
fi

export FRITZBOX_HOST="${HOST}"
export FRITZBOX_USERNAME="${USERNAME}"
export FRITZBOX_PASSWORD="${PASSWORD}"

if command -v curl >/dev/null 2>&1; then
  if curl -s --connect-timeout 3 "http://${HOST}" >/dev/null 2>&1 || \
     curl -sk --connect-timeout 3 "https://${HOST}" >/dev/null 2>&1; then
    bashio::log.info "FRITZ!Box at ${HOST} is reachable"
  else
    bashio::log.warning "Could not reach FRITZ!Box at ${HOST}"
  fi
fi

cd /app
exec node dist/index.js --http --port "${PORT}"
