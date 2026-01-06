# PostgreSQL Connection Fix

## Problem
PostgreSQL service is running but not accepting TCP/IP connections on port 5432.

## Solution Options

### Option 1: Use pgAdmin (Easiest)
1. Open **pgAdmin 4** from Start Menu
2. Connect to your local PostgreSQL server (it uses local socket, not TCP/IP)
3. Right-click on "Databases" → Create → Database
4. Name it: `FYP_Intellisight`
5. Click Save

### Option 2: Configure PostgreSQL to Accept TCP/IP
1. Find your PostgreSQL data directory (usually `C:\Program Files\PostgreSQL\18\data`)
2. Edit `postgresql.conf`:
   - Find line: `#listen_addresses = 'localhost'`
   - Change to: `listen_addresses = '*'` (or `'localhost'`)
   - Save file
3. Edit `pg_hba.conf`:
   - Add line: `host    all             all             127.0.0.1/32            md5`
4. Restart PostgreSQL:
   - Open Services (services.msc)
   - Find "postgresql-x64-18"
   - Right-click → Restart

### Option 3: Create Database via pgAdmin Query Tool
1. Open pgAdmin 4
2. Connect to PostgreSQL server
3. Click on "postgres" database
4. Click "Query Tool" (lightning bolt icon)
5. Run: `CREATE DATABASE "FYP_Intellisight";`
6. Press F5 or click Execute

### Option 4: Check if Password is Correct
Your current password in .env is: `zeeshan`

If this is incorrect:
1. Open pgAdmin
2. Right-click "postgres" user → Properties
3. Change password
4. Update `.env` file with correct password

## After Creating Database
Run these commands:
```bash
npx prisma db push
npm run dev
```

## Verify Connection
After setup, this should work:
```
npm run dev
```
You should see: "✅ Database connected successfully"
