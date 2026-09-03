#!/usr/bin/env python3
# Moves every Meta Graph HTTP node from query-string auth (token in the URL,
# echoed back by Graph in paging.next and stored in n8n execution data) to a
# header credential. The founder creates the header credential in n8n first:
#   type: Header Auth, name: Authorization, value: Bearer <Meta system-user token>
# then runs:
#   python3 scripts/n8n-swap-meta-auth.py <new_credential_id> [--apply]
# Without --apply it only lists the nodes it would change. With --apply it PUTs
# each affected workflow, one at a time, and re-reads it to confirm.
import json, os, re, sys, urllib.request, socket

socket.setdefaulttimeout(60)
OLD_ID = "u1iFg2OArYUi98PF"   # "Meta system-user token (query access_token)"
B = "https://singularweb.app.n8n.cloud/api/v1/"

def api_key():
    k = os.environ.get("N8N_API_KEY")
    if k: return k
    txt = open(os.path.expanduser("~/.config/singularweb/substrate.env")).read()
    m = re.search(r'^N8N_API_KEY="?([^"\n]+)"?$', txt, re.M)
    if not m: sys.exit("N8N_API_KEY not found")
    return m.group(1)

def req(path, method="GET", body=None, key=None):
    r = urllib.request.Request(B + path, method=method, headers={"X-N8N-API-KEY": key, "Content-Type": "application/json"},
                               data=json.dumps(body).encode() if body is not None else None)
    return json.load(urllib.request.urlopen(r))

if len(sys.argv) < 2: sys.exit(__doc__ or "usage: n8n-swap-meta-auth.py <new_credential_id> [--apply]")
NEW_ID = sys.argv[1]; APPLY = "--apply" in sys.argv
key = api_key()
new = next((c for c in req("credentials?limit=100", key=key)["data"] if c["id"] == NEW_ID), None)
if not new or new["type"] != "httpHeaderAuth": sys.exit(f"credential {NEW_ID} not found or not Header Auth")
print(f"target credential: {new['name']} ({new['type']})")

wfs = []; cur = None
while True:
    d = req("workflows?limit=100" + (f"&cursor={cur}" if cur else ""), key=key); wfs += d["data"]; cur = d.get("nextCursor")
    if not cur: break
for w in wfs:
    hits = [n for n in w["nodes"] if (n.get("credentials") or {}).get("httpQueryAuth", {}).get("id") == OLD_ID]
    if not hits: continue
    print(f"\n{w['name']} ({w['id']}): {len(hits)} node(s)")
    for n in hits:
        print(f"   {n['name']}")
        if APPLY:
            n["parameters"]["genericAuthType"] = "httpHeaderAuth"
            n["credentials"].pop("httpQueryAuth", None)
            n["credentials"]["httpHeaderAuth"] = {"id": NEW_ID, "name": new["name"]}
    if APPLY:
        res = req("workflows/" + w["id"], "PUT", {"name": w["name"], "nodes": w["nodes"], "connections": w["connections"], "settings": w.get("settings") or {}}, key=key)
        left = [n["name"] for n in res["nodes"] if (n.get("credentials") or {}).get("httpQueryAuth", {}).get("id") == OLD_ID]
        print(f"   PUT ok, query-auth nodes remaining: {left or 'none'}")
if not APPLY: print("\nDry run. Re-run with --apply to change the workflows.")
