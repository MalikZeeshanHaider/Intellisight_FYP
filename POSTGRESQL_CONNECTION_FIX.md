# 🔧 PostgreSQL Connection Fix - WSL to Windows

**Issue**: PostgreSQL on Windows is not accessible from WSL  
**Date**: December 28, 2025

---

## 🚨 Quick Fix Steps

### Step 1: Check PostgreSQL is Running on Windows

Open **Windows Command Prompt (Run as Administrator)**:

```cmd
# Check service status
net start | findstr postgres

# If not running, start it
net start postgresql-x64-16

# Or for older versions
net start postgresql-x64-15
```

### Step 2: Find Your PostgreSQL Port

Open **Windows Command Prompt**:

```cmd
# Connect to PostgreSQL
psql -U postgres

# Inside psql, check port
SHOW port;

# Exit
\q
```

**Expected port**: Should be `5000` (or `5432` by default)

### Step 3: Configure PostgreSQL to Accept WSL Connections

#### Option A: Using pgAdmin 4 (Easier)

1. Open **pgAdmin 4** from Start Menu
2. Right-click **PostgreSQL 16** → Properties
3. Go to **Connection** tab
4. Note the **Host** and **Port**

#### Option B: Edit Configuration Files (Advanced)

**File 1**: `postgresql.conf`

Location: `C:\Program Files\PostgreSQL\16\data\postgresql.conf`

Find and change:
```conf
# Change from:
#listen_addresses = 'localhost'

# To:
listen_addresses = '*'
```

**File 2**: `pg_hba.conf`

Location: `C:\Program Files\PostgreSQL\16\data\pg_hba.conf`

Add these lines **at the top** (before other rules):
```conf
# WSL Connection
host    all             all             10.0.0.0/8              md5
host    all             all             172.16.0.0/12           md5
host    all             all             192.168.0.0/16          md5
host    all             all             127.0.0.1/32            md5
```

### Step 4: Restart PostgreSQL Service

**Windows Command Prompt (Run as Administrator)**:

```cmd
# Stop PostgreSQL
net stop postgresql-x64-16

# Start PostgreSQL
net start postgresql-x64-16
```

### Step 5: Configure Windows Firewall

**Option A: Using GUI**

1. Open **Windows Defender Firewall**
2. Click **Advanced settings**
3. Click **Inbound Rules** → **New Rule**
4. Select **Port** → Click **Next**
5. Select **TCP** → Enter port: `5000` (or `5432`)
6. Select **Allow the connection**
7. Apply to all profiles
8. Name it: "PostgreSQL WSL"

**Option B: Using Command**

**Windows Command Prompt (Run as Administrator)**:

```cmd
# Allow port 5000
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5000

# Or if using default port 5432
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
```

### Step 6: Test Connection from WSL

Back in **WSL Ubuntu**:

```bash
# Install PostgreSQL client if needed
sudo apt-get install -y postgresql-client

# Test connection with localhost
psql -h localhost -p 5000 -U postgres -d FYP_Intellisight

# Or test with Windows IP
psql -h 10.255.255.254 -p 5000 -U postgres -d FYP_Intellisight

# Enter password: ozair
```

---

## 🔍 Troubleshooting

### Issue 1: "Password authentication failed"

**Solution**: Reset PostgreSQL password

```cmd
# In Windows Command Prompt
psql -U postgres

# Inside psql
ALTER USER postgres WITH PASSWORD 'ozair';
\q
```

### Issue 2: "Database does not exist"

**Solution**: Create the database

```cmd
# In Windows Command Prompt
psql -U postgres

# Inside psql
CREATE DATABASE "FYP_Intellisight";
GRANT ALL PRIVILEGES ON DATABASE "FYP_Intellisight" TO postgres;
\q
```

### Issue 3: "Connection refused" or "Can't reach database"

**Possible Causes & Solutions**:

1. **PostgreSQL not running**
   ```cmd
   net start postgresql-x64-16
   ```

2. **Wrong port in .env**
   - Check actual PostgreSQL port: `psql -U postgres` then `SHOW port;`
   - Update `.env` file with correct port

3. **Firewall blocking**
   - Disable Windows Firewall temporarily to test
   - If works, add firewall rule (see Step 5)

4. **pg_hba.conf not configured**
   - Add WSL IP ranges (see Step 3)
   - Restart PostgreSQL service

### Issue 4: "Port 5432 instead of 5000"

If PostgreSQL is running on port 5432 (default) instead of 5000:

**Update .env file**:
```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP
nano .env
```

Change:
```env
DATABASE_URL="postgresql://postgres:ozair@10.255.255.254:5432/FYP_Intellisight?schema=public"
```

---

## 🎯 Quick Diagnosis Commands

### In Windows Command Prompt:

```cmd
# Check PostgreSQL service
sc query postgresql-x64-16

# Check listening ports
netstat -an | findstr :5000
netstat -an | findstr :5432

# Test local connection
psql -U postgres -p 5000 -d FYP_Intellisight
```

### In WSL Ubuntu:

```bash
# Check if port is reachable
nc -zv localhost 5000
nc -zv 10.255.255.254 5000

# Or
telnet localhost 5000
telnet 10.255.255.254 5000
```

---

## ✅ Verification Checklist

- [ ] PostgreSQL service running (Windows)
- [ ] Correct port identified (5000 or 5432)
- [ ] `postgresql.conf` - listen_addresses set to '*'
- [ ] `pg_hba.conf` - WSL IP ranges added
- [ ] PostgreSQL service restarted
- [ ] Windows Firewall allows the port
- [ ] Database "FYP_Intellisight" exists
- [ ] Password is "ozair"
- [ ] Can connect from WSL using psql

---

## 🔧 Alternative Solutions

### Solution 1: Use PostgreSQL on WSL Instead

If Windows PostgreSQL continues to have issues:

```bash
# Install PostgreSQL on WSL
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

# Start service
sudo service postgresql start

# Create user and database
sudo -u postgres psql
CREATE USER postgres WITH PASSWORD 'ozair';
CREATE DATABASE "FYP_Intellisight" OWNER postgres;
GRANT ALL PRIVILEGES ON DATABASE "FYP_Intellisight" TO postgres;
\q

# Update .env
DATABASE_URL="postgresql://postgres:ozair@localhost:5432/FYP_Intellisight?schema=public"
```

### Solution 2: Use Docker PostgreSQL

```bash
# Install Docker on WSL
docker run --name postgres -e POSTGRES_PASSWORD=ozair -e POSTGRES_DB=FYP_Intellisight -p 5000:5432 -d postgres:16

# Update .env
DATABASE_URL="postgresql://postgres:ozair@localhost:5000/FYP_Intellisight?schema=public"
```

---

## 📞 Need More Help?

### Check PostgreSQL Installation Path

Common locations:
- `C:\Program Files\PostgreSQL\16\`
- `C:\Program Files\PostgreSQL\15\`
- `C:\Program Files\PostgreSQL\14\`

### Find PostgreSQL Data Directory

In Windows Command Prompt:
```cmd
psql -U postgres -c "SHOW data_directory;"
```

### View PostgreSQL Logs

Location: `C:\Program Files\PostgreSQL\16\data\log\`

Check latest log file for errors.

---

## 🚀 After Connection Works

Once you can connect from WSL:

```bash
cd /mnt/e/FYP/Intellisight_FYP/new/Intellisight_FYP

# Run migrations
npx prisma migrate dev

# Start system
./start.sh
```

---

**Last Updated**: December 28, 2025  
**Status**: Waiting for PostgreSQL configuration
