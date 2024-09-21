#!/bin/bash

file="/etc/nukleus-webapp/config.json"

source /etc/placeholder-entrypoint/placeholder-entrypoint-library.sh

verifyJSON

setConfigValue "CONFIGURATION_VALUE_STRIPE_KEY" "stripeKey"
setConfigValue "CONFIGURATION_VALUE_WEB_URL" "webUrl"

searchUnusedPlaceholders

nginx -g "daemon off;"
