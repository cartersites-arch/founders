"""Create a private session for the existing development proof account.

Uses the development Admin API to create and verify a link without sending email.
No user, role, membership, or production record is changed.
"""

import json
import os
from pathlib import Path
import urllib.request
from urllib.parse import urlparse

base = os.environ["SUPABASE_URL"].rstrip("/")
assert urlparse(base).hostname == "vpewpybdvtnhwxhzyubc.supabase.co"
workspace = "0944aa62-2f20-4937-9cea-e5c06992f7bc"
owner = "5a514263-e1bc-4981-965e-780301fb71b8"
admin_headers = {
    "apikey": os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    "Authorization": "Bearer " + os.environ["SUPABASE_SERVICE_ROLE_KEY"],
    "Content-Type": "application/json",
}


def request(path, data=None, headers=admin_headers):
    req = urllib.request.Request(
        base + path,
        data=json.dumps(data).encode() if data else None,
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


members = request(
    f"/rest/v1/workspace_members?select=user_id,role&workspace_id=eq.{workspace}"
)
assert any(m["user_id"] == owner and m["role"] == "owner" for m in members)
assert not request(f"/rest/v1/user_roles?select=role&user_id=eq.{owner}&role=eq.admin")
user = request("/auth/v1/admin/users/" + owner)
link = request("/auth/v1/admin/generate_link", {"type": "magiclink", "email": user["email"]})
session = request(
    "/auth/v1/verify",
    {"type": "magiclink", "token_hash": link["hashed_token"]},
    {"apikey": os.environ["SUPABASE_PUBLISHABLE_KEY"], "Content-Type": "application/json"},
)
target = Path(os.environ.get("PROOF_SESSION_FILE", "/tmp/founders-proof-browser/session.json"))
target.parent.mkdir(parents=True, exist_ok=True)
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
os.fchmod(fd, 0o600)
with os.fdopen(fd, "w") as output:
    json.dump(session, output)
print("Development proof session saved privately; no email sent.")
