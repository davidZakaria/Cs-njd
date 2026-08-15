# Deploy on VPS (after git push)

Run these on the server as **root**:

```bash
ssh root@72.61.192.84
cd /var/www/cs-njd
bash deploy/update.sh
```

## If `git pull` fails

```bash
cd /var/www/cs-njd
git checkout -- deploy/update.sh
git pull origin main
bash deploy/update.sh
```

## If you get 502 after a reboot

```bash
pm2 resurrect
pm2 save
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login
```

Expect **200**. Site: **https://cs-njd.duckdns.org**

## Manual deploy (same as `update.sh`)

```bash
cd /var/www/cs-njd
git pull origin main
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build:strict
pm2 restart cs-njd-crm --update-env
pm2 save
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:3001/en/login
```
