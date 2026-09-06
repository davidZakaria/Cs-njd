# njd-crm.com on GoDaddy — locked parking A records

GoDaddy often **locks** two `@` A records (`15.197.225.128`, `3.33.251.168`) when a parked site or forwarding is active. You **cannot edit or delete** them until that is removed.

---

## Recommended: use **app.njd-crm.com** (works in 5 minutes)

New DNS records are usually **not** locked.

### In GoDaddy → DNS → Add New Record

| Type | Name | Data | TTL |
|------|------|------|-----|
| **A** | **app** | **72.61.192.84** | 1 Hour |

Do **not** remove your existing `@` records — leave them.

Wait **10–15 minutes**, then on the VPS:

```bash
ssh root@72.61.192.84
cd /var/www/cs-njd
git pull origin main
bash deploy/setup-domain.sh app.njd-crm.com
```

Your CRM URL: **https://app.njd-crm.com**

---

## Later: fix **njd-crm.com** (apex) — pick one

### Option A — Unlock @ records on GoDaddy

1. **DNS → Forwarding** — delete any forward  
2. **Overview** — disconnect Website / Coming Soon / Airo  
3. Retry delete or edit the two parking **A** records  
4. Keep only **one** `@` A → `72.61.192.84`  
5. Run: `bash deploy/setup-domain.sh njd-crm.com`

### Option B — Cloudflare (best if GoDaddy keeps locking)

1. Add **njd-crm.com** to [Cloudflare](https://dash.cloudflare.com) (free plan)  
2. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`)  
3. GoDaddy → **Nameservers** → Change to Custom → paste Cloudflare NS  
4. In **Cloudflare DNS** only:
   - `A` `@` → `72.61.192.84`
   - `CNAME` `www` → `njd-crm.com`
   - `A` `app` → `72.61.192.84` (optional, keep subdomain)
5. After propagation: `bash deploy/setup-domain.sh njd-crm.com`

Parking records on GoDaddy DNS are ignored once nameservers point to Cloudflare.

---

## Verify DNS

```bash
dig +short app.njd-crm.com A @8.8.8.8
# should show only: 72.61.192.84
```

```bash
dig +short njd-crm.com A @8.8.8.8
# apex may show 3 IPs until fixed — that breaks SSL for njd-crm.com
```

---

## Legacy URL

**https://cs-njd.duckdns.org** continues to work until you switch everyone to the new domain.
