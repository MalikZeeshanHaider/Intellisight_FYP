@echo off
REM ============================================================
REM  PostgreSQL Setup Script for Windows
REM  Automates database creation after PostgreSQL installation
REM ============================================================

title IntelliSight - PostgreSQL Setup
color 0A

echo.
echo  ================================================================
echo  ^|         INTELLISIGHT - POSTGRESQL SETUP                      ^|
echo  ================================================================
echo.

REM Check if PostgreSQL is installed
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] PostgreSQL is not installed or not in PATH!
    echo.
    echo Please install PostgreSQL first:
    echo 1. Download from: https://www.postgresql.org/download/windows/
    echo 2. Install with port 5000
    echo 3. Set password: ozair
    echo 4. Run this script again
    echo.
    pause
    exit /b 1
)

echo [OK] PostgreSQL found
echo.

REM Set variables
set PGUSER=postgres
set PGPASSWORD=ozair
set PGPORT=5000
set PGHOST=localhost
set DBNAME=FYP_Intellisight

echo [*] Configuration:
echo     Host: %PGHOST%
echo     Port: %PGPORT%
echo     User: %PGUSER%
echo     Database: %DBNAME%
echo.

REM Test connection
echo [*] Testing PostgreSQL connection...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -c "SELECT version();" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to PostgreSQL!
    echo.
    echo Possible reasons:
    echo 1. PostgreSQL service is not running
    echo 2. Password is incorrect (should be: ozair)
    echo 3. Port is wrong (should be: 5000)
    echo.
    echo To fix:
    echo - Start PostgreSQL service: net start postgresql-x64-16
    echo - Check password in pgAdmin
    echo.
    pause
    exit /b 1
)
echo [OK] Connection successful
echo.

REM Check if database exists
echo [*] Checking if database exists...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -lqt | findstr /C:"%DBNAME%" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [WARNING] Database '%DBNAME%' already exists!
    echo.
    set /p RECREATE="Do you want to drop and recreate it? (y/N): "
    if /i "%RECREATE%"=="y" (
        echo [*] Dropping existing database...
        psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -c "DROP DATABASE \"%DBNAME%\";"
        if %ERRORLEVEL% NEQ 0 (
            echo [ERROR] Failed to drop database!
            pause
            exit /b 1
        )
        echo [OK] Database dropped
    ) else (
        echo [*] Using existing database
        goto :CONFIGURE_ACCESS
    )
)

REM Create database
echo [*] Creating database '%DBNAME%'...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -c "CREATE DATABASE \"%DBNAME%\";"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to create database!
    pause
    exit /b 1
)
echo [OK] Database created
echo.

REM Grant privileges
echo [*] Granting privileges...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -c "GRANT ALL PRIVILEGES ON DATABASE \"%DBNAME%\" TO postgres;"
echo [OK] Privileges granted
echo.

:CONFIGURE_ACCESS
REM Configure access
echo [*] Configuring PostgreSQL access...
echo.
echo IMPORTANT: You need to manually update pg_hba.conf
echo.
echo File location:
echo C:\Program Files\PostgreSQL\16\data\pg_hba.conf
echo.
echo Add these lines at the top:
echo host    all             all             127.0.0.1/32            md5
echo host    all             all             172.16.0.0/12           md5
echo.
echo Then restart PostgreSQL service:
echo net stop postgresql-x64-16
echo net start postgresql-x64-16
echo.
set /p CONFIGURED="Have you done this? (y/N): "
if /i not "%CONFIGURED%"=="y" (
    echo.
    echo [WARNING] Please configure pg_hba.conf manually
    echo See POSTGRESQL_WINDOWS_SETUP.md for details
    echo.
)

REM Test database connection
echo [*] Testing database connection...
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %DBNAME% -c "SELECT current_database();"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Cannot connect to database!
    pause
    exit /b 1
)
echo [OK] Database connection successful
echo.

REM Display summary
echo.
echo  ================================================================
echo  ^|                   SETUP COMPLETE                             ^|
echo  ================================================================
echo.
echo  Database Details:
echo  - Host: %PGHOST%
echo  - Port: %PGPORT%
echo  - Database: %DBNAME%
echo  - User: %PGUSER%
echo  - Password: %PGPASSWORD%
echo.
echo  Connection String:
echo  postgresql://%PGUSER%:%PGPASSWORD%@%PGHOST%:%PGPORT%/%DBNAME%?schema=public
echo.
echo  Next Steps:
echo  1. Update .env file with DATABASE_URL
echo  2. Run: npm install
echo  3. Run: npx prisma generate
echo  4. Run: npx prisma migrate dev
echo  5. Run: start.bat (or start.sh in WSL)
echo.
echo  To manage database:
echo  - Open pgAdmin 4 from Start Menu
echo  - Or run: psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %DBNAME%
echo.
pause
