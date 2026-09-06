# Cloudflare setup for njd-crm.com (Phase 2 — manual)

Cloudflare hides your VPS origin IP and adds a free WAF in front of the CRM. **You must complete this in the Cloudflare dashboard and GoDaddy** — it cannot be automated from the repo alone.

## Prerequisites

- Domain registered at **GoDaddy**: `njd-crm.com`
- VPS origin: `72.61.192.84` (already serving HTTPS via Let's Encrypt)
- Nginx rate limiting already applied on the VPS (`crm_limit` zone)

## Step 1 — Add site to Cloudflare

1. Sign up / sign in at [https://dash.cloudflare.com](https://dash.cloudflare.com)
2. **Add a site** → enter `njd-crm.com`
3. Choose the **Free** plan
4. Cloudflare scans existing DNS records — confirm:
   - **A** `@` → `72.61.192.84` (Proxied — orange cloud)
   - **A** `www` → `72.61.192.84` (Proxied)
   - **A** `app` → `72.61.192.84` (Proxied) if you use `app.njd-crm.com`

## Step 2 — Change nameservers at GoDaddy

1. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`)
2. In **GoDaddy** → Domain → **DNS** → **Nameservers** → **Change** → **Enter my own nameservers**
3. Paste Cloudflare’s nameservers and save
4. Propagation can take up to 24–48 hours (often under 1 hour)
5. In Cloudflare, wait until status is **Active**

See also [`deploy/GODADDY-DNS.md`](GODADDY-DNS.md) for GoDaddy DNS troubleshooting.

## Step 3 — SSL/TLS mode

In Cloudflare → **SSL/TLS** → **Overview**:

- Set encryption mode to **Full (strict)**  
  (Origin already has a valid Let’s Encrypt cert on the VPS.)

Under **Edge Certificates**:

- Enable **Always Use HTTPS**
- Enable **Automatic HTTPS Rewrites** (optional)

## Step 4 — WAF & bot protection (Free tier)

In **Security** → **Settings**:

- **Security Level**: Medium or High
- Enable **Bot Fight Mode** (Free)

In **Security** → **WAF** (if available on your plan):

- Review managed rules; enable core OWASP-style protections where offered on Free

## Step 5 — Real client IP (important for rate limiting)

Once proxied, login rate limits use `X-Forwarded-For`. Nginx already sets:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

Cloudflare sends the visitor IP in `CF-Connecting-IP`. Optional hardening on the VPS — in `/etc/nginx/sites-available/njd-crm.com` inside `location /`:

```nginx
# Trust Cloudflare only after you restrict origin access (Step 6)
real_ip_header CF-Connecting-IP;
# include Cloudflare IP ranges — see https://www.cloudflare.com/ips/
```

Only add `real_ip` after you understand origin locking; otherwise keep current headers (app still works).

## Step 6 — Lock origin to Cloudflare (optional, recommended after go-live)

After Cloudflare is **Active** and the site works through the proxy:

1. On the VPS, restrict nginx to accept traffic only from [Cloudflare IP ranges](https://www.cloudflare.com/ips/)
2. Or use UFW to allow `80`/`443` only from Cloudflare CIDRs (blocks direct hits to `72.61.192.84`)

**Do not** enable origin lock until Cloudflare proxy is verified — you would block legitimate users.

## Verification checklist

- [ ] `https://njd-crm.com` loads via Cloudflare (check response headers for `cf-ray`)
- [ ] Login + 2FA still work
- [ ] Executive dashboard loads for Management
- [ ] GoDaddy parking page is gone for root domain
- [ ] SSL Labs or browser shows valid certificate

## Rollback

If something breaks:

1. GoDaddy → restore **GoDaddy nameservers** (default)
2. Ensure A records point to `72.61.192.84`
3. Wait for DNS propagation; CRM continues to work directly on the VPS
