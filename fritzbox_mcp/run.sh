#!/usr/bin/with-contenv bashio
set -e

HOST=$(bashio::config 'host')
USERNAME=$(bashio::config 'username')
PASSWORD=$(bashio::config 'password')
PORT=$(bashio::config 'port')

bashio::log.info "Starting FRITZ!Box MCP Server..."
bashio::log.info "Host: ${HOST}"
bashio::log.info "Port: ${PORT}"

if [ -z "${USERNAME}" ] || [ -z "${PASSWORD}" ]; then
  bashio::log.warning "Username or password not set. Please configure the add-on options."
fi

export FRITZBOX_HOST="${HOST}"
export FRITZBOX_USERNAME="${USERNAME}"
export FRITZBOX_PASSWORD="${PASSWORD}"

cd /app
exec node dist/index.js --http --port "${PORT}"
