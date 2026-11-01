#!/usr/bin/env bash
# Render CLI 一键部署（Free Web Service）
# 需要：RENDER_API_KEY
# 代码源二选一：
#   A) --repo 指向已推送的 Git 仓库（推荐公开或已授权 Render 的 GitHub）
#   B) --image 指向已构建的 Docker 镜像
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="${PATH}:${HOME}/.local/bin"

: "${RENDER_API_KEY:?请设置 RENDER_API_KEY（https://dashboard.render.com/u/settings#api-keys）}"

SERVICE_NAME="${RENDER_SERVICE_NAME:-qingchen-inventory}"
REPO_URL="${RENDER_REPO_URL:-https://github.com/Hanqing-Ding/qingchen-Fashion.git}"
BRANCH="${RENDER_BRANCH:-main}"
REGION="${RENDER_REGION:-singapore}"
PLAN="${RENDER_PLAN:-free}"

# Load Supabase env for --env-var flags
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
: "${NEXT_PUBLIC_SUPABASE_URL:?}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?}"
: "${NEXT_PUBLIC_USE_MOCK_DATA:=true}"

echo "→ Whoami…"
render whoami -o json --confirm

EXISTING="$(render services -o json --confirm 2>/dev/null || echo '[]')"
SERVICE_ID="$(EXISTING="$EXISTING" SERVICE_NAME="$SERVICE_NAME" python3 - <<'PY'
import json,os
name=os.environ["SERVICE_NAME"]
try: data=json.loads(os.environ.get("EXISTING") or "[]")
except Exception: data=[]
if isinstance(data, dict):
  data=data.get("services") or data.get("data") or data.get("items") or []
for s in data or []:
  svc=s.get("service") if isinstance(s.get("service"), dict) else s
  n=svc.get("name") or svc.get("Name") or ""
  if n==name:
    print(svc.get("id") or svc.get("serviceId") or "")
    break
PY
)"

if [[ -n "${SERVICE_ID:-}" ]]; then
  echo "→ Service exists ($SERVICE_ID), triggering deploy…"
  render deploys create "$SERVICE_ID" --wait --confirm -o json
else
  echo "→ Creating Free web service from $REPO_URL …"
  CREATE_ARGS=(
    services create
    --name "$SERVICE_NAME"
    --type web_service
    --repo "$REPO_URL"
    --branch "$BRANCH"
    --runtime node
    --plan "$PLAN"
    --region "$REGION"
    --build-command "npm ci && npm run build"
    --start-command "npm start"
    --health-check-path "/login"
    --env-var "NODE_VERSION=20"
    --env-var "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}"
    --env-var "NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}"
    --env-var "NEXT_PUBLIC_USE_MOCK_DATA=${NEXT_PUBLIC_USE_MOCK_DATA}"
    --confirm
    -o json
  )
  if [[ "${RENDER_AUTO_DEPLOY:-true}" == "false" ]]; then
    CREATE_ARGS+=(--auto-deploy=false)
  fi
  render "${CREATE_ARGS[@]}" | tee /tmp/render-create.json
  SERVICE_ID="$(python3 - <<'PY'
import json,re
text=open("/tmp/render-create.json").read()
try:
  d=json.loads(text)
except Exception:
  d=None
  for c in re.findall(r'\{.*\}', text, re.S):
    try: d=json.loads(c); break
    except Exception: pass
if isinstance(d, dict):
  print(d.get("id") or d.get("serviceId") or (d.get("service") or {}).get("id") or "")
else:
  print("")
PY
)"
fi

echo "service_id=${SERVICE_ID:-unknown}"
# Persist
python3 - <<PY
import json
json.dump({"service_id":"${SERVICE_ID:-}","service_name":"$SERVICE_NAME","repo":"$REPO_URL"}, open(".render-deploy.json","w"), indent=2)
PY

echo "→ Listing service URL…"
render services -o json --confirm | tee /tmp/render-services.json
python3 - <<'PY'
import json
data=json.load(open("/tmp/render-services.json"))
if isinstance(data, dict):
  data=data.get("services") or data.get("data") or []
for s in data or []:
  svc=s.get("service") if isinstance(s.get("service"), dict) else s
  if (svc.get("name") or "")=="qingchen-inventory" or True:
    url=svc.get("serviceDetails",{}).get("url") if isinstance(svc.get("serviceDetails"),dict) else None
    url=url or svc.get("url") or svc.get("dashboardUrl")
    sid=svc.get("id")
    print(f"{svc.get('name')}: id={sid} url={url}")
PY

echo "Done. Permanent URL is usually https://<service-name>.onrender.com"
