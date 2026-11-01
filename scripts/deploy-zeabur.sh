#!/usr/bin/env bash
# 一键部署到 Zeabur（本地直推，不经 GitHub）
# 需要：ZEABUR_TOKEN
# 可选：ZEABUR_SERVER_ID（ZeaburOS 服务器 ID）、ZEABUR_PROJECT_NAME、ZEABUR_SERVICE_NAME、ZEABUR_DOMAIN_PREFIX
set -euo pipefail
cd "$(dirname "$0")/.."

TOKEN="${ZEABUR_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "缺少 ZEABUR_TOKEN。请到 https://zeabur.com/account/token 创建后 export ZEABUR_TOKEN=..." >&2
  exit 1
fi

PROJECT_NAME="${ZEABUR_PROJECT_NAME:-qingchen-fashion}"
SERVICE_NAME="${ZEABUR_SERVICE_NAME:-qingchen-inventory}"
DOMAIN_PREFIX="${ZEABUR_DOMAIN_PREFIX:-qingchen-fashion}"
IDS_FILE="${ZEABUR_IDS_FILE:-.zeabur-deploy.json}"

load_dotenv() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  set -a
  # shellcheck disable=SC1090
  source <(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_USE_MOCK_DATA)=' "$f" | sed 's/\r$//; s/^export //')
  set +a
}
load_dotenv .env.zeabur
load_dotenv .env.local

: "${NEXT_PUBLIC_SUPABASE_URL:?请设置 NEXT_PUBLIC_SUPABASE_URL}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?请设置 NEXT_PUBLIC_SUPABASE_ANON_KEY}"
: "${NEXT_PUBLIC_USE_MOCK_DATA:=true}"

ZB() { npx --yes zeabur@latest "$@"; }

echo "→ Login…"
ZB auth login --token "$TOKEN"

PROJECT_ID=""
SERVICE_ID=""
if [[ -f "$IDS_FILE" ]]; then
  PROJECT_ID="$(python3 -c "import json;print(json.load(open('$IDS_FILE')).get('project_id',''))")"
  SERVICE_ID="$(python3 -c "import json;print(json.load(open('$IDS_FILE')).get('service_id',''))")"
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "→ List existing projects…"
  PROJECTS_JSON="$(ZB project list -i=false --json 2>/dev/null || echo '[]')"
  PROJECT_ID="$(PROJECT_NAME="$PROJECT_NAME" PROJECTS_JSON="$PROJECTS_JSON" python3 - <<'PY'
import json,os
name=os.environ["PROJECT_NAME"]
raw=os.environ.get("PROJECTS_JSON") or "[]"
try: data=json.loads(raw)
except Exception: data=[]
if isinstance(data, dict):
  data=data.get("projects") or data.get("data") or data.get("items") or []
for p in data or []:
  if (p.get("name") or p.get("Name"))==name:
    print(p.get("_id") or p.get("id") or "")
    break
PY
)"
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "→ Resolve ZeaburOS server for new project…"
  SERVERS_JSON="$(ZB server list -i=false --json 2>/dev/null || echo '[]')"
  SERVER_ID="${ZEABUR_SERVER_ID:-}"
  if [[ -z "$SERVER_ID" ]]; then
    SERVER_ID="$(SERVERS_JSON="$SERVERS_JSON" python3 - <<'PY'
import json,os
raw=os.environ.get("SERVERS_JSON") or "[]"
try: data=json.loads(raw)
except Exception: data=[]
if isinstance(data, dict):
  data=data.get("servers") or data.get("data") or data.get("items") or []
cands=[]
for s in data or []:
  osname=(s.get("os") or s.get("OS") or s.get("operatingSystem") or "")
  sid=s.get("id") or s.get("_id") or s.get("ID") or ""
  if sid and str(osname).lower() in ("zeaburos","zeabur-os","zeabur"):
    cands.append(sid)
print(cands[0] if len(cands)==1 else "")
if len(cands)!=1:
  import sys
  print(f"# zeabur_os_servers={len(cands)} ids={' '.join(cands)}", file=sys.stderr)
PY
)"
  fi
  if [[ -z "$SERVER_ID" ]]; then
    echo "无法自动选择服务器。请设置 ZEABUR_SERVER_ID，或先在 Zeabur 租一台 ZeaburOS 服务器。" >&2
    echo "servers json:" >&2
    echo "$SERVERS_JSON" >&2
    exit 1
  fi
  REGION="server-${SERVER_ID}"
  echo "  creating project $PROJECT_NAME on $REGION…"
  CREATE_JSON="$(ZB project create -n "$PROJECT_NAME" -r "$REGION" -i=false --json 2>&1 | tee /tmp/zeabur-project-create.json)"
  PROJECT_ID="$(CREATE_JSON="$CREATE_JSON" PROJECT_NAME="$PROJECT_NAME" python3 - <<'PY'
import json,os,re
text=os.environ.get("CREATE_JSON") or ""
name=os.environ["PROJECT_NAME"]
try: d=json.loads(text)
except Exception:
  d=None
  for chunk in re.findall(r'\{.*\}', text, re.S):
    try: d=json.loads(chunk); break
    except Exception: pass
if isinstance(d, dict):
  print(d.get("_id") or d.get("id") or (d.get("project") or {}).get("_id") or (d.get("project") or {}).get("id") or "")
else:
  m=re.search(r'\b[a-f0-9]{24}\b', text)
  print(m.group(0) if m else "")
PY
)"
  if [[ -z "$PROJECT_ID" ]]; then
    # fallback list by name
    PROJECTS_JSON="$(ZB project list -i=false --json)"
    PROJECT_ID="$(PROJECT_NAME="$PROJECT_NAME" PROJECTS_JSON="$PROJECTS_JSON" python3 - <<'PY'
import json,os
name=os.environ["PROJECT_NAME"]; data=json.loads(os.environ["PROJECTS_JSON"] or "[]")
if isinstance(data, dict): data=data.get("projects") or data.get("data") or []
for p in data or []:
  if (p.get("name") or "")==name:
    print(p.get("_id") or p.get("id") or ""); break
PY
)"
  fi
fi

if [[ -z "$PROJECT_ID" ]]; then
  echo "无法取得 project id" >&2
  exit 1
fi
echo "  project_id=$PROJECT_ID"

echo "→ Deploy (direct upload)…"
DEPLOY_ARGS=(deploy --project-id "$PROJECT_ID" --name "$SERVICE_NAME" --json)
if [[ -n "$SERVICE_ID" ]]; then
  DEPLOY_ARGS+=(--service-id "$SERVICE_ID")
fi
DEPLOY_JSON="$(ZB "${DEPLOY_ARGS[@]}" 2>&1 | tee /tmp/zeabur-deploy.json)"
NEW_SERVICE_ID="$(DEPLOY_JSON="$DEPLOY_JSON" python3 - <<'PY'
import json,os,re
text=os.environ.get("DEPLOY_JSON") or ""
try: d=json.loads(text)
except Exception:
  d=None
  for chunk in re.findall(r'\{.*?\}', text, re.S):
    try:
      d=json.loads(chunk)
      if isinstance(d, dict) and (d.get("service_id") or d.get("serviceId") or (d.get("service") or {}).get("_id")):
        break
    except Exception:
      pass
if isinstance(d, dict):
  print(d.get("service_id") or d.get("serviceId") or (d.get("service") or {}).get("_id") or (d.get("service") or {}).get("id") or "")
else:
  print("")
PY
)"
SERVICE_ID="${NEW_SERVICE_ID:-$SERVICE_ID}"
if [[ -z "$SERVICE_ID" ]]; then
  echo "部署完成但未解析到 service_id，原始输出见 /tmp/zeabur-deploy.json" >&2
  exit 1
fi
echo "  service_id=$SERVICE_ID"

python3 - <<PY
import json
json.dump({"project_id":"$PROJECT_ID","service_id":"$SERVICE_ID","service_name":"$SERVICE_NAME"}, open("$IDS_FILE","w"), indent=2)
print("saved $IDS_FILE")
PY

echo "→ Set env vars…"
# Prefer create; if exists, update
ZB variable create --id "$SERVICE_ID" \
  -k "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  -k "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -k "NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA}" \
  -y -i=false 2>/dev/null \
|| ZB variable update --id "$SERVICE_ID" \
  -k "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" \
  -k "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}" \
  -k "NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA}" \
  -y -i=false

echo "→ Bind generated domain (${DOMAIN_PREFIX}.zeabur.app)…"
ZB domain create --id "$SERVICE_ID" -g --domain "$DOMAIN_PREFIX" -y -i=false 2>&1 | tee /tmp/zeabur-domain.json || true

echo "→ Domains:"
ZB domain list --id "$SERVICE_ID" -i=false --json 2>&1 | tee /tmp/zeabur-domains.json

echo "→ Restart to apply env…"
# env-id optional; try without first
ZB service restart --service-id "$SERVICE_ID" -i=false 2>&1 || true

echo
echo "Dashboard: https://zeabur.com/projects/${PROJECT_ID}"
echo "Expected URL: https://${DOMAIN_PREFIX}.zeabur.app"
