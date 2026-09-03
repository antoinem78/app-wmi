#!/usr/bin/env python3
# Deploys the generated optimise workflows to n8n, node for node, so what runs
# is what the generator says and what the tests exercised. Regenerates first,
# then PUTs name/nodes/connections/settings to the two known workflow ids.
# Active state, tags and ids are read-only on the public API and untouched.
#
#   python3 scripts/deploy-optimise-workflows.py            # both
#   python3 scripts/deploy-optimise-workflows.py execute    # one of: optimise | execute
#
# N8N_API_KEY comes from the environment or ~/.config/singularweb/substrate.env.
import json, os, re, subprocess, sys, tempfile, urllib.request

IDS = {"optimise": ("wf_optimise.json", "tgmHGKPDNy78Ozkd"),
       "execute":  ("wf_execute.json",  "ywJvDCQfDSPJYdbQ")}
BASE = "https://singularweb.app.n8n.cloud/api/v1/workflows/"

def api_key():
    k = os.environ.get("N8N_API_KEY")
    if k: return k
    p = os.path.expanduser("~/.config/singularweb/substrate.env")
    m = re.search(r'^N8N_API_KEY="?([^"\n]+)"?$', open(p).read(), re.M)
    if not m: sys.exit("N8N_API_KEY not found")
    return m.group(1)

which = sys.argv[1:] or list(IDS)
out = tempfile.mkdtemp()
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), "build-optimise-workflows.py"), out],
               check=True, stdout=subprocess.DEVNULL)
key = api_key()
for w in which:
    fname, wid = IDS[w]
    wf = json.load(open(os.path.join(out, fname)))
    body = json.dumps({"name": wf["name"], "nodes": wf["nodes"], "connections": wf["connections"],
                       "settings": wf.get("settings", {})}).encode()
    req = urllib.request.Request(BASE + wid, data=body, method="PUT",
                                 headers={"X-N8N-API-KEY": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        res = json.load(r)
    print(f"deployed {wf['name']} ({wid}): {len(res['nodes'])} nodes, active={res.get('active')}, updated {res.get('updatedAt')}")
