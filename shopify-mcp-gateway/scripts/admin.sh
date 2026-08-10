#!/usr/bin/env bash
#
# Admin CLI for the Shopify MCP Gateway.
#
# Requires two environment variables:
#   GW         the gateway base URL, e.g. https://shopify-mcp-gateway.example.workers.dev
#   ADMIN_KEY  the ADMIN_API_KEY secret, or an access token for an admin user
#
# Usage:
#   ./scripts/admin.sh overview
#   ./scripts/admin.sh grant maria@starpilwax.com --role operator
#   ./scripts/admin.sh grant maria@starpilwax.com --scopes products:read,products:write --store waxsupply.myshopify.com
#   ./scripts/admin.sh revoke maria@starpilwax.com --scopes discounts:write
#   ./scripts/admin.sh offboard maria@starpilwax.com
#   ./scripts/admin.sh service-account nightly-sync --scopes inventory:read,inventory:write
#   ./scripts/admin.sh rotate svc_abc123
#   ./scripts/admin.sh label starpil.myshopify.com "Starpil US"

set -euo pipefail

: "${GW:?Set GW to the gateway base URL, e.g. https://gateway.example.workers.dev}"
: "${ADMIN_KEY:?Set ADMIN_KEY to your ADMIN_API_KEY secret or an admin access token}"

GW="${GW%/}"   # tolerate a trailing slash

api() {
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "$GW$path" \
      -H "Authorization: Bearer $ADMIN_KEY" \
      -H "Content-Type: application/json" \
      -d "$body"
  else
    curl -sS -X "$method" "$GW$path" -H "Authorization: Bearer $ADMIN_KEY"
  fi
  echo
}

# Build a JSON array literal from a comma-separated list: a,b -> ["a","b"]
json_array() {
  local IFS=','
  read -ra items <<< "$1"
  local out="["
  for i in "${!items[@]}"; do
    [[ $i -gt 0 ]] && out+=","
    out+="\"${items[$i]}\""
  done
  echo "$out]"
}

usage() {
  sed -n '3,20p' "$0" | sed 's/^# \{0,1\}//'
  exit 1
}

[[ $# -ge 1 ]] || usage
command="$1"; shift

case "$command" in
  overview)
    api GET /admin/overview
    ;;

  grant|revoke)
    [[ $# -ge 1 ]] || { echo "error: $command needs a principal (email or service-account name)"; exit 1; }
    principal="$1"; shift

    scopes=""; role=""; store=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --scopes) scopes="$2"; shift 2 ;;
        --role)   role="$2";   shift 2 ;;
        --store)  store="$2";  shift 2 ;;
        *) echo "error: unknown flag $1"; exit 1 ;;
      esac
    done

    [[ -n "$scopes" || -n "$role" ]] || { echo "error: pass --scopes and/or --role"; exit 1; }

    body="{\"principal\":\"$principal\""
    [[ -n "$scopes" ]] && body+=",\"scopes\":$(json_array "$scopes")"
    [[ -n "$role"   ]] && body+=",\"role\":\"$role\""
    [[ -n "$store"  ]] && body+=",\"store\":\"$store\""
    [[ "$command" == "revoke" ]] && body+=",\"revoke\":true"
    body+="}"

    api POST /admin/permissions "$body"
    ;;

  offboard)
    [[ $# -ge 1 ]] || { echo "error: offboard needs an email"; exit 1; }
    # Suspends, drops all grants, and revokes live tokens immediately.
    api POST /admin/users "{\"email\":\"$1\",\"offboard\":true}"
    ;;

  suspend)
    [[ $# -ge 1 ]] || { echo "error: suspend needs an email"; exit 1; }
    api POST /admin/users "{\"email\":\"$1\",\"status\":\"suspended\"}"
    ;;

  reactivate)
    [[ $# -ge 1 ]] || { echo "error: reactivate needs an email"; exit 1; }
    api POST /admin/users "{\"email\":\"$1\",\"status\":\"active\"}"
    ;;

  service-account)
    [[ $# -ge 1 ]] || { echo "error: service-account needs a name"; exit 1; }
    name="$1"; shift

    scopes=""; store=""; description=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --scopes)      scopes="$2";      shift 2 ;;
        --store)       store="$2";       shift 2 ;;
        --description) description="$2"; shift 2 ;;
        *) echo "error: unknown flag $1"; exit 1 ;;
      esac
    done

    body="{\"name\":\"$name\""
    [[ -n "$scopes"      ]] && body+=",\"scopes\":$(json_array "$scopes")"
    [[ -n "$store"       ]] && body+=",\"store\":\"$store\""
    [[ -n "$description" ]] && body+=",\"description\":\"$description\""
    body+="}"

    echo "The token below is shown once and cannot be recovered. Save it now."
    api POST /admin/service-accounts "$body"
    ;;

  rotate)
    [[ $# -ge 1 ]] || { echo "error: rotate needs a service-account id"; exit 1; }
    api POST /admin/service-accounts/rotate "{\"id\":\"$1\"}"
    ;;

  revoke-service-account)
    [[ $# -ge 1 ]] || { echo "error: needs a service-account id"; exit 1; }
    api POST /admin/service-accounts/revoke "{\"id\":\"$1\",\"removeGrants\":true}"
    ;;

  label)
    [[ $# -ge 2 ]] || { echo "error: label needs a store and a new label"; exit 1; }
    api POST /admin/stores "{\"store\":\"$1\",\"label\":\"$2\"}"
    ;;

  *)
    usage
    ;;
esac
