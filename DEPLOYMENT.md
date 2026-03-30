# CashFlow Deployment Guide

## 📦 Deployment Options

This guide covers deployment on AWS, Heroku, and Docker environments.

---

## 🔧 Pre-Deployment Checklist

- [ ] All `.env` variables configured
- [ ] Database schema created and verified
- [ ] Stored procedures and triggers installed
- [ ] Backend server tested locally (`npm start`)
- [ ] Frontend tested locally
- [ ] All tests pass (`npm test`)
- [ ] Git repository initialized and committed

---

## ☁️ Option 1: AWS Deployment (Recommended)

### Part 1: Database Setup (AWS RDS)

#### Create RDS Instance

1. Login to AWS Console
2. Navigate to RDS > Databases > Create Database
3. Choose:
   - Engine: MySQL 5.7 or 8.0
   - DB Instance Class: db.t3.micro (free tier eligible)
   - Master username: `admin`
   - Master password: (save securely)
   - Database name: `cashflow_db`
   - Publicly accessible: Yes (for development)

4. After creation, note the endpoint:
   ```
   cashflow-db.xxxxx.amazonaws.com:3306
   ```

#### Configure Security Groups

1. In RDS instance, modify Security Group
2. Add inbound rule:
   - Type: MySQL/Aurora
   - Protocol: TCP
   - Port: 3306
   - Source: 0.0.0.0/0 (restrict to your IP in production)

#### Initialize Database

Connect to RDS and run:

```bash
# Using MySQL CLI
mysql -h cashflow-db.xxxxx.amazonaws.com -u admin -p < backend/db/schema.sql
mysql -h cashflow-db.xxxxx.amazonaws.com -u admin -p < backend/db/procedures.sql
mysql -h cashflow-db.xxxxx.amazonaws.com -u admin -p < backend/db/triggers.sql
```

Or use MySQL Workbench:
1. Create connection to RDS endpoint
2. Run schema.sql → procedures.sql → triggers.sql

---

### Part 2: Backend Deployment (EC2)

#### Launch EC2 Instance

1. EC2 Dashboard > Instances > Launch Instance
2. Choose:
   - AMI: Ubuntu 20.04 LTS
   - Instance type: t3.micro (free tier)
   - Security Group: Allow SSH (22), HTTP (80), HTTPS (443), Custom TCP (5000)

3. Save key pair (.pem file)

#### Connect and Deploy

```bash
# SSH into instance
ssh -i /path/to/key.pem ubuntu@<EC2_PUBLIC_IP>

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install git -y

# Clone repository
git clone <your-repo-url> /var/www/cashflow
cd /var/www/cashflow/backend

# Install dependencies
npm install --production

# Create .env with production settings
sudo nano .env
# Add:
# DB_HOST=cashflow-db.xxxxx.amazonaws.com
# DB_USER=admin
# DB_PASSWORD=your_password
# DB_NAME=cashflow_db
# JWT_SECRET=your_long_secret_key_here
# PORT=5000
# NODE_ENV=production
```

#### Setup PM2 Process Manager

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start application
pm2 start server.js --name "cashflow-api"

# Setup auto-restart on reboot
pm2 startup
pm2 save

# Monitor
pm2 logs cashflow-api
```

#### Setup Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install nginx -y

# Create config
sudo nano /etc/nginx/sites-available/cashflow

# Add:
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/cashflow /etc/nginx/sites-enabled/

# Test and restart
sudo nginx -t
sudo systemctl restart nginx
```

#### Setup SSL Certificate (Optional - Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

### Part 3: Frontend Deployment (S3 + CloudFront)

#### Upload to S3

```bash
# Install AWS CLI
pip install awscli

# Configure AWS credentials
aws configure

# Create S3 bucket
aws s3 mb s3://cashflow-frontend --region us-east-1

# Upload frontend files
aws s3 sync frontend/ s3://cashflow-frontend/ --exclude ".git*"

# Make files public
aws s3api put-bucket-policy --bucket cashflow-frontend \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::cashflow-frontend/*"
    }]
  }'

# Enable static website hosting
aws s3api put-bucket-website \
  --bucket cashflow-frontend \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "index.html"}
  }'
```

#### CloudFront Distribution (Optional - CDN)

1. AWS Console > CloudFront > Create Distribution
2. Choose:
   - Origin: cashflow-frontend.s3.amazonaws.com
   - Cache behavior: Default TTL 300
   - Custom domain (requires SSL cert)

3. Update frontend app.js to use API endpoint:
```javascript
const API_URL = 'https://your-domain.com/api';
```

---

## 🚀 Option 2: Heroku Deployment

### Backend Deployment

```bash
# Install Heroku CLI
curl https://cli-assets.heroku.com/install.sh | sh

# Login
heroku login

# Create app
heroku create cashflow-api

# Add MySQL add-on (ClearDB)
heroku addons:create cleardb:ignite

# Get database URL
heroku config:get CLEARDB_DATABASE_URL

# Set environment variables
heroku config:set JWT_SECRET=your_secret_key
heroku config:set NODE_ENV=production

# Create Procfile
echo "web: node server.js" > Procfile

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### Frontend Deployment

#### Option A: Heroku Static with BuildPacks

```bash
# Create static app
heroku create cashflow-frontend

# Add static buildpack
heroku buildpacks:add https://github.com/heroku/heroku-buildpack-static.git

# Create static.json
cat > static.json << 'EOF'
{
  "root": "./frontend",
  "clean_urls": true,
  "routes": {
    "/**": "index.html"
  }
}
EOF

git push heroku main
```

#### Option B: Netlify

1. Connect GitHub repository to Netlify
2. Build command: (leave empty)
3. Publish directory: `frontend`
4. Add environment variable:
   ```
   REACT_APP_API_URL=https://cashflow-api.herokuapp.com/api
   ```

---

## 🐳 Option 3: Docker Deployment

### Create Dockerfile

```dockerfile
# Dockerfile for CashFlow Backend
FROM node:16-alpine

WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy application
COPY backend/ .

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server.js"]
```

### Create docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpass
      MYSQL_DATABASE: cashflow_db
      MYSQL_USER: cashflow
      MYSQL_PASSWORD: cashflowpass
    ports:
      - "3306:3306"
    volumes:
      - db_data:/var/lib/mysql
      - ./backend/db/schema.sql:/docker-entrypoint-initdb.d/1-schema.sql
      - ./backend/db/procedures.sql:/docker-entrypoint-initdb.d/2-procedures.sql
      - ./backend/db/triggers.sql:/docker-entrypoint-initdb.d/3-triggers.sql

  backend:
    build: .
    environment:
      DB_HOST: mysql
      DB_USER: cashflow
      DB_PASSWORD: cashflowpass
      DB_NAME: cashflow_db
      JWT_SECRET: your_secret_here
      PORT: 5000
    ports:
      - "5000:5000"
    depends_on:
      - mysql

  frontend:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./frontend:/usr/share/nginx/html
    depends_on:
      - backend

volumes:
  db_data:
```

### Deploy with Docker

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

---

## 🔒 Production Best Practices

### Security

1. **Environment Variables**
   - Never commit .env files
   - Use secrets management (AWS Secrets Manager, HashiCorp Vault)
   - Rotate JWT_SECRET regularly

2. **Database**
   - Use RDS with encryption at rest
   - Enable automated backups
   - Restrict security group access to app server only

3. **API**
   - Enable CORS only for frontend domain
   - Implement rate limiting
   - Use HTTPS/TLS (Let's Encrypt)
   - Add API key authentication for external services

4. **Application**
   - Set NODE_ENV=production
   - Enable logging and monitoring
   - Use secrets for database credentials
   - Implement request validation

### Monitoring

```bash
# CloudWatch logs for EC2
sudo tail -f /var/log/syslog

# PM2 monitoring
pm2 plus

# Application logs
pm2 logs cashflow-api

# Database monitoring (AWS RDS)
# CloudWatch > RDS > Performance Insights
```

### Backup & Disaster Recovery

```bash
# RDS automated backups (AWS)
# Enabled by default, 7-day retention

# Manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier cashflow-db \
  --db-snapshot-identifier cashflow-db-backup-$(date +%s)

# Database dump
mysqldump -h cashflow-db.xxxxx.amazonaws.com -u admin -p cashflow_db > backup.sql
```

---

## 📊 Performance Optimization

### Database

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_user_email ON User(email);
CREATE INDEX idx_account_user_id ON Account(user_id);
CREATE INDEX idx_transaction_account ON Transaction(from_account_id, to_account_id);
CREATE INDEX idx_audit_timestamp ON Audit_Log(timestamp);
```

### Caching

```javascript
// Add Redis caching for dashboard
const redis = require('redis');
const client = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

// Cache cash flow calculations
const cacheKey = `cashflow_${userId}_${month}_${year}`;
const cached = await client.get(cacheKey);
if (cached) return JSON.parse(cached);
```

### API Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});

app.use('/api/', limiter);
```

---

## 🚨 Troubleshooting

### RDS Connection Failed
```
Error: connect ECONNREFUSED
```
**Solution:**
- Verify security group allows port 3306 from EC2
- Check RDS endpoint in .env
- Verify database exists: `SHOW DATABASES;`

### PM2 Not Starting
```
pm2 start server.js fails
```
**Solution:**
```bash
pm2 kill
pm2 start server.js --name "cashflow-api"
pm2 list
```

### Nginx: Bad Gateway
```
502 Bad Gateway
```
**Solution:**
- Check backend running: `ps aux | grep node`
- Verify port 5000 is bound: `sudo netstat -tlnp`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### SSL Certificate Issues
```
certbot renewal failing
```
**Solution:**
```bash
sudo certbot renew --dry-run
sudo systemctl restart certbot.timer
```

---

## 📈 Scaling Considerations

### Horizontal Scaling
1. Load Balancer (AWS ELB/ALB)
2. Multiple EC2 instances running backend
3. Auto-scaling groups based on CPU/memory

### Vertical Scaling
1. Upgrade EC2 instance type (t3.micro → t3.medium)
2. Upgrade RDS instance
3. Add read replicas for database

### Database Optimization
1. Add MySQL replication
2. Implement query caching
3. Shard data by user_id

---

## 📝 Deployment Checklist

- [ ] RDS instance created and running
- [ ] Database schema installed
- [ ] EC2 instance running Ubuntu
- [ ] Node.js and npm installed
- [ ] Application code deployed
- [ ] .env configured with production values
- [ ] PM2 running
- [ ] Nginx configured as reverse proxy
- [ ] SSL certificate installed
- [ ] Frontend deployed (S3/Netlify)
- [ ] Custom domain configured
- [ ] Monitoring and logging enabled
- [ ] Backups automated
- [ ] Load testing completed
- [ ] User acceptance testing passed

---

## 🎯 Success Indicators

✅ API responding at https://your-domain.com/api/health  
✅ Frontend loading at https://your-domain.com  
✅ Users can register and login  
✅ Database accepting transactions  
✅ Audit logs recording activities  
✅ No errors in PM2 logs  

---

**Deployment complete!** 🎉

For ongoing support, monitor:
- CloudWatch metrics
- PM2 dashboard
- Application logs
- Database performance
