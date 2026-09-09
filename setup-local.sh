#!/usr/bin/env bash
# First run on a new machine: writes a private .env with freshly generated
# secrets. Starting the stack is left to docker compose, so that this script
# finishes quickly and the terminal stays free.
#
# Safe to run again. An existing .env is kept as it is, except that a secret
# still holding the template placeholder is replaced — copying .env.example by
# hand otherwise leaves the API unable to start.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

if ! command -v openssl >/dev/null 2>&1; then
  echo "ต้องติดตั้ง OpenSSL ก่อน / OpenSSL is required" >&2
  exit 1
fi

# The API needs 32 bytes of base64 for HS256, and rejects anything shorter or
# not valid base64.
new_jwt_secret() { openssl rand -base64 32 | tr -d '\n'; }
new_admin_password() { openssl rand -hex 12; }

# True when the value is empty or still the text shipped in .env.example.
needs_generating() {
  case "$1" in
    "" | replace-with-* | change-this-*) return 0 ;;
    *) return 1 ;;
  esac
}

read_value() {
  # Everything after the first "=", so a base64 secret keeps its padding.
  grep "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true
}

replace_value() {
  local key=$1 value=$2 tmp=".env.tmp.$$"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      "$key="*) echo "$key=$value" ;;
      *) echo "$line" ;;
    esac
  done < .env > "$tmp"
  mv "$tmp" .env
}

if [ ! -f .env ]; then
  jwt_secret="$(new_jwt_secret)"
  admin_password="$(new_admin_password)"
  tmp_file=".env.tmp.$$"

  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      APP_JWT_SECRET=*) echo "APP_JWT_SECRET=$jwt_secret" >> "$tmp_file" ;;
      BOOTSTRAP_ADMIN_PASSWORD=*) echo "BOOTSTRAP_ADMIN_PASSWORD=$admin_password" >> "$tmp_file" ;;
      *) echo "$line" >> "$tmp_file" ;;
    esac
  done < .env.example

  mv "$tmp_file" .env
  echo "สร้าง .env แล้ว / Created .env"
  echo
  echo "  Admin email:    admin@example.com"
  echo "  Admin password: $admin_password"
  echo
  echo "เก็บรหัสนี้ไว้ เพราะจะแสดงเฉพาะครั้งแรก"
  echo "Save that password — it is shown only once."
else
  echo "พบ .env อยู่แล้ว จะไม่เขียนทับค่าที่ตั้งไว้เอง"

  if needs_generating "$(read_value APP_JWT_SECRET)"; then
    replace_value APP_JWT_SECRET "$(new_jwt_secret)"
    echo "  · APP_JWT_SECRET ยังเป็นค่าตัวอย่าง — สุ่มใหม่ให้แล้ว"
  fi

  if needs_generating "$(read_value BOOTSTRAP_ADMIN_PASSWORD)"; then
    admin_password="$(new_admin_password)"
    replace_value BOOTSTRAP_ADMIN_PASSWORD "$admin_password"
    echo "  · BOOTSTRAP_ADMIN_PASSWORD ยังเป็นค่าตัวอย่าง — ตั้งใหม่เป็น: $admin_password"
  fi
fi

echo
echo "ขั้นต่อไป / Next:"
echo "  docker compose up -d --build"
