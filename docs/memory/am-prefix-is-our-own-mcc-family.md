---
name: am-prefix-is-our-own-mcc-family
description: "The AM | campaign prefix is the founder's own manager accounts (AM MCC B / J / Top MCC, level-1 children of the WMI Ltd MCC), and who HOLDS an account is read from the manager tree plus customer_user_access, never from change_event"
metadata:
  node_type: memory
  type: reference
---

Fly-Rides' three live campaigns are named `AM | Search | ...`, which read as an outside manager's convention. They are not. Verified 2026-08-28 from customer 7345621720 and the MCC tree: **`AM` is Antoine Martin.** Three manager accounts sit as level-1 children of the Web Marketing International Ltd MCC (`8618153241`): **AM MCC B `3604109688`, AM MCC J `2343567521`, AM Top MCC `5982299625`**, alongside SingularWeb.ai and WMI FZCO. Their admins are `antoinemcc2/4/6/7@gmail.com`, invited by `antoine.martin@wmiltd.com`. Of 41 accounts visible in the tree, 27 sit at level 2, i.e. under those AM managers rather than directly under WMI.

So an `AM |` campaign, or any account reachable only at `customer_client.level = 2`, is inside our own hierarchy. Treat that naming as ours until proven otherwise.

**Why:** `change_event` answers who EDITED an account in the last 30 days. It does not answer who HOLDS it, and the two came apart here: every human edit at Fly-Rides was `booking@fly-rides.com`, the client's own login, while the account and its whole campaign structure sit under the founder's manager account. Reading only the edit log would have produced "the client runs it themselves"; reading only the campaign names would have produced "an unidentified agency runs it". Both wrong on their own.

**How to apply:** to establish who holds and who can touch an account, run three reads and put them side by side.

1. `customer_client` from our MCC with `WHERE customer_client.id = <id>`, taking `level` (2 means an intermediate manager) then `customer_client.manager = true` to name the managers in the tree.
2. `customer_manager_link` from the client account, which lists every manager link with status. Ours can show INACTIVE while reads still succeed, because access is inherited through the intermediate manager, so INACTIVE against our MCC id is not loss of access.
3. `customer_user_access`, which gives email, `access_role`, `access_creation_date_time` and `inviter_user_email_address` for every user with direct access. This is the only read that names people, has no 30-day cap, and the invite dates often line up with campaign-name dates (Fly-Rides: an ADMIN added 2025-11-07 against `Nov 2025` campaigns, another 2026-03-21 against `March 2026`).

Then `change_event` for who actually moved things, per [[pull-change-history-before-judging-an-account]]. Note it caps hard at 30 days: `LAST_90_DAYS` is not even a valid literal for it, and an explicit older start date returns `START_DATE_TOO_OLD`. A 90-day operator question cannot be answered from change history, only from access history. And a login is still not a person: [[contractor-identity-is-not-the-visible-identity]].
