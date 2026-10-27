"""Run locally. Copy the JSON result into the Cloudflare STAFF_USERS_JSON secret."""
import getpass
import hashlib
import json
import secrets

username = input('직원 아이디: ').strip()
name = input('직원 이름: ').strip()
role = input('권한 (staff/admin, 기본 staff): ').strip() or 'staff'
password = getpass.getpass('비밀번호 (화면에 표시되지 않음): ')
assert username and len(username) <= 80 and name and role in ('staff', 'admin')
assert len(password) >= 12, '12자 이상 비밀번호를 사용하세요.'
assert password == getpass.getpass('비밀번호 재입력: '), '비밀번호가 일치하지 않습니다.'
salt = secrets.token_hex(16)
digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 100000).hex()
print(json.dumps([{'username': username, 'name': name, 'role': role, 'salt': salt, 'hash': digest}], ensure_ascii=False))
