# IntelliSight Backend - Deployment Guide

## 🚀 Production Deployment Guide

This guide covers deploying the IntelliSight backend to various platforms.

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ database
- Git for version control
- Domain name (optional but recommended)

---

## Option 1: Railway.app Deployment (Recommended)

Railway provides easy deployment with PostgreSQL database included.

### Steps:

1. **Install Railway CLI**
```bash
npm install -g @railway/cli
```

2. **Login to Railway**
```bash
railway login
```

3. **Initialize Project**
```bash
railway init
```

4. **Add PostgreSQL Database**
```bash
railway add
# Select PostgreSQL from the list
```

5. **Set Environment Variables**
```bash
railway variables set JWT_SECRET="your-32-char-secret-key-here"
railway variables set JWT_EXPIRES_IN="7d"
railway variables set BCRYPT_ROUNDS="10"
railway variables set NODE_ENV="production"
```

6. **Deploy**
```bash
railway up
```

7. **Run Migrations**
```bash
railway run npx prisma migrate deploy
railway run npm run seed
```

8. **Get Your URL**
```bash
railway domain
```

**Cost:** Free tier available, then ~$5/month

---

## Option 2: Heroku Deployment

### Steps:

1. **Install Heroku CLI**
```bash
# Windows (using winget)
winget install Heroku.HerokuCLI

# Or download from https://devcenter.heroku.com/articles/heroku-cli
```

2. **Login**
```bash
heroku login
```

3. **Create App**
```bash
heroku create intellisight-backend
```

4. **Add PostgreSQL**
```bash
heroku addons:create heroku-postgresql:mini
```

5. **Set Environment Variables**
```bash
heroku config:set JWT_SECRET="your-32-char-secret-key-here"
heroku config:set JWT_EXPIRES_IN="7d"
heroku config:set BCRYPT_ROUNDS="10"
heroku config:set NODE_ENV="production"
```

6. **Deploy**
```bash
git push heroku main
```

7. **Run Migrations**
```bash
heroku run npx prisma migrate deploy
heroku run npm run seed
```

8. **Open App**
```bash
heroku open
```

**Cost:** ~$5-7/month for Eco dynos + database

---

## Option 3: Docker + VPS (DigitalOcean, Linode, AWS EC2)

### Steps:

1. **Provision VPS**
   - Ubuntu 22.04 LTS
   - Minimum: 1 vCPU, 1GB RAM
   - Recommended: 2 vCPU, 2GB RAM

2. **SSH into Server**
```bash
ssh root@your-server-ip
```

3. **Install Docker & Docker Compose**
```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y
```

4. **Clone Repository**
```bash
git clone https://github.com/your-repo/intellisight-backend.git
cd intellisight-backend
```

5. **Create .env File**
```bash
nano .env
```

Paste:
```env
DATABASE_URL="postgresql://postgres:YOUR_STRONG_PASSWORD@postgres:5432/FYP_Intellisight?schema=public"
JWT_SECRET="your-32-char-cryptographically-secure-secret"
JWT_EXPIRES_IN="24h"
BCRYPT_ROUNDS=12
PORT=3000
NODE_ENV="production"
CORS_ORIGINS="https://yourdomain.com"
```

6. **Update docker-compose.yml**
```bash
nano docker-compose.yml
```

Update PostgreSQL password:
```yaml
POSTGRES_PASSWORD: YOUR_STRONG_PASSWORD
```

7. **Start Services**
```bash
docker-compose up -d
```

8. **Run Migrations**
```bash
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run seed
```

9. **Setup Nginx Reverse Proxy**
```bash
apt install nginx -y
nano /etc/nginx/sites-available/intellisight
```

Paste:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/intellisight /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

10. **Setup SSL with Let's Encrypt**
```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d your-domain.com
```

11. **Setup Firewall**
```bash
ufw allow 22
ufw allow 80
ufw allow 443
ufw enable
```

**Cost:** $5-12/month depending on provider

---

## Option 4: AWS Elastic Beanstalk

### Steps:

1. **Install EB CLI**
```bash
pip install awsebcli
```

2. **Initialize**
```bash
eb init -p node.js-18 intellisight-backend
```

3. **Create Environment**
```bash
eb create intellisight-production
```

4. **Add RDS Database**
```bash
eb create --database.engine postgres
```

5. **Set Environment Variables**
```bash
eb setenv JWT_SECRET="your-secret" NODE_ENV="production"
```

6. **Deploy**
```bash
eb deploy
```

**Cost:** ~$15-30/month

---

## Post-Deployment Checklist

### Security

- [ ] Changed default JWT_SECRET to cryptographically secure random string
- [ ] Set strong PostgreSQL password
- [ ] Enabled HTTPS/SSL
- [ ] Configured CORS with specific origins (not `*`)
- [ ] Set up firewall rules
- [ ] Disabled unnecessary ports
- [ ] Set BCRYPT_ROUNDS to 12 for production
- [ ] Reviewed and secured all API endpoints

### Performance

- [ ] Database indexes created (Prisma handles this)
- [ ] Connection pooling configured
- [ ] Set appropriate JWT expiration time
- [ ] Enabled gzip compression (Nginx/Platform)
- [ ] Set up CDN for static assets if needed

### Monitoring

- [ ] Set up logging (Winston, Pino, or platform logs)
- [ ] Configure error tracking (Sentry, Rollbar)
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Database backup strategy
- [ ] Health check endpoint working

### Backups

- [ ] Automated database backups enabled
- [ ] Backup retention policy defined
- [ ] Tested restore procedure
- [ ] Environment variables backed up securely

---

## Environment Variables Reference

### Required Variables

```env
DATABASE_URL="postgresql://user:password@host:port/database?schema=public"
JWT_SECRET="minimum-32-characters-random-string"
```

### Optional Variables (with defaults)

```env
JWT_EXPIRES_IN="7d"          # Token expiration (7d, 24h, etc.)
BCRYPT_ROUNDS=10             # 10 for dev, 12 for production
PORT=3000                    # Server port
NODE_ENV="production"        # production | development | test
CORS_ORIGINS="*"             # Comma-separated origins
LOG_LEVEL="info"             # error | warn | info | debug
MAX_FILE_SIZE=5242880        # Max upload size in bytes (5MB)
```

---

## Database Migration Strategy

### Development
```bash
npx prisma migrate dev --name description_of_changes
```

### Production
```bash
# Never use migrate dev in production!
npx prisma migrate deploy
```

### Rollback
```bash
# Manual rollback required
# Restore database backup from before migration
```

---

## Monitoring & Logging

### Log Files

Logs are written to console. For production, pipe to file:

```bash
# Using PM2
pm2 start src/server.js --name intellisight --log /var/log/intellisight.log

# Using systemd
journalctl -u intellisight -f
```

### Health Check

Monitor: `https://your-domain.com/health`

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2025-11-19T...",
    "database": "connected"
  }
}
```

### Error Tracking

Integrate Sentry:

```bash
npm install @sentry/node
```

In `src/server.js`:
```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

---

## Scaling Considerations

### Horizontal Scaling

- Deploy multiple instances behind load balancer
- Use Redis for session storage (if sessions added)
- Database connection pooling

### Vertical Scaling

- Upgrade server CPU/RAM
- Optimize database queries
- Add database read replicas

### Database Optimization

```sql
-- Analyze query performance
EXPLAIN ANALYZE SELECT ...;

-- Add indexes if needed (Prisma handles most)
CREATE INDEX idx_custom ON table(column);
```

---

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker-compose logs backend

# Check database connection
docker-compose exec backend npx prisma db pull

# Verify environment variables
docker-compose exec backend printenv
```

### Database Connection Fails

```bash
# Test connection manually
psql "postgresql://user:password@host:port/database"

# Check if database exists
docker-compose exec postgres psql -U postgres -l
```

### 502 Bad Gateway (Nginx)

```bash
# Check backend is running
curl http://localhost:3000/health

# Check Nginx config
nginx -t

# Check Nginx logs
tail -f /var/log/nginx/error.log
```

---

## Maintenance

### Update Dependencies

```bash
npm update
npm audit fix
```

### Database Backup

```bash
# Backup
pg_dump -U postgres -h localhost -p 5000 FYP_Intellisight > backup.sql

# Restore
psql -U postgres -h localhost -p 5000 FYP_Intellisight < backup.sql
```

### Zero-Downtime Deployment

1. Deploy new version to staging
2. Run migrations on staging
3. Test thoroughly
4. Deploy to production with blue-green strategy
5. Run `npx prisma migrate deploy`
6. Switch traffic to new version

---

## Cost Optimization

### Free Tier Options

- **Railway:** $5 free credit monthly
- **Render:** Free PostgreSQL + web service (limited)
- **Fly.io:** Free allowance for small apps

### Cost-Effective Stack

- Railway: ~$5/month
- Cloudflare for DNS/CDN: Free
- UptimeRobot monitoring: Free
- Total: ~$5-10/month

---

## Security Best Practices

1. **Never commit .env file**
2. **Use environment variables for all secrets**
3. **Enable HTTPS only in production**
4. **Implement rate limiting** (express-rate-limit)
5. **Sanitize user inputs** (already done with Zod)
6. **Use helmet middleware** (already configured)
7. **Keep dependencies updated**
8. **Regular security audits:** `npm audit`

---

## Support & Documentation

- **API Docs:** Import `postman_collection.json` into Postman
- **Sample Requests:** See `SAMPLE_REQUESTS.md`
- **Health Endpoint:** `/health`
- **Prisma Studio:** `npx prisma studio`

---

**Deployment Complete! 🎉**

Your IntelliSight backend is now production-ready.
