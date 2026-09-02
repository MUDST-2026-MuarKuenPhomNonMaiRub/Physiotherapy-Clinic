#!/usr/bin/env bash
set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "ต้องติดตั้ง OpenSSL ก่อน" >&2
  exit 1
fi

if [ ! -f .env ]; then
  jwt_secret="$(openssl rand -base64 32 | tr -d '\n')"
  admin_password="$(openssl rand -hex 12)"
  tmp_file=".env.tmp.$$"

  while IFS= read -r line; do
    case "$line" in
      APP_JWT_SECRET=*) echo "APP_JWT_SECRET=$jwt_secret" >> "$tmp_file" ;;
      BOOTSTRAP_ADMIN_PASSWORD=*) echo "BOOTSTRAP_ADMIN_PASSWORD=$admin_password" >> "$tmp_file" ;;
      *) echo "$line" >> "$tmp_file" ;;
    esac
  done < .env.example

  mv "$tmp_file" .env
  echo "สร้าง .env แล้ว"
  echo "Admin email: admin@example.com"
  echo "Admin password: $admin_password"
  echo "เก็บรหัสนี้ไว้ เพราะจะแสดงเฉพาะครั้งแรก"
else
  echo "พบ .env อยู่แล้ว จะไม่เขียนทับค่าเดิม"
fi

docker compose up --build
