#!/usr/bin/env bash
# 一键部署到 Vercel（不经过 GitHub）。需环境变量 VERCEL_TOKEN。
# 可选：VERCEL_ORG_ID / VERCEL_PROJECT_ID（已有项目时复用）
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "缺少 VERCEL_TOKEN。请到 https://vercel.com/account/tokens 创建后导出：" >&2
  echo "  export VERCEL_TOKEN=xxx" >&2
  exit 1
fi

# 从 .env.local 读取 Supabase（若未在 shell 中显式提供）
if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source <(grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_ANON_KEY|NEXT_PUBLIC_USE_MOCK_DATA)=' .env.local | sed 's/\r$//')
  set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?请设置 NEXT_PUBLIC_SUPABASE_URL}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?请设置 NEXT_PUBLIC_SUPABASE_ANON_KEY}"

# 生产预览默认开 Mock，避免未跑迁移时整站空白；联调真实库时设 false
export NEXT_PUBLIC_USE_MOCK_DATA="${NEXT_PUBLIC_USE_MOCK_DATA:-true}"

echo "→ Linking / creating Vercel project (no Git)…"
npx --yes vercel@latest link --yes --token "$VERCEL_TOKEN"

echo "→ Upserting env vars for production + preview…"
upsert_env() {
  local key="$1" val="$2" target="$3"
  # remove existing then add (idempotent-ish)
  npx --yes vercel@latest env rm "$key" "$target" --yes --token "$VERCEL_TOKEN" >/dev/null 2>&1 || true
  printf '%s' "$val" | npx --yes vercel@latest env add "$key" "$target" --token "$VERCEL_TOKEN"
}

for target in production preview development; do
  upsert_env NEXT_PUBLIC_SUPABASE_URL "$NEXT_PUBLIC_SUPABASE_URL" "$target"
  upsert_env NEXT_PUBLIC_SUPABASE_ANON_KEY "$NEXT_PUBLIC_SUPABASE_ANON_KEY" "$target"
  upsert_env NEXT_PUBLIC_USE_MOCK_DATA "$NEXT_PUBLIC_USE_MOCK_DATA" "$target"
done

echo "→ Deploying production…"
npx --yes vercel@latest deploy --prod --yes --token "$VERCEL_TOKEN"
