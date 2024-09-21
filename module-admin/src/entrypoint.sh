#!/bin/bash

file="/etc/nukleus-module-admin/config.json"

source /etc/placeholder-entrypoint/placeholder-entrypoint-library.sh

verifyJSON

setConfigValue "CONFIGURATION_VALUE_JOBS_URL" "jobsURL"

searchUnusedPlaceholders

nginx -g "daemon off;"
