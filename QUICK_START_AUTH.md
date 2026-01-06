# Quick Start Guide - Authentication Setup

## ⚡ 3-Step Quick Setup

### Step 1: Install Dependencies ✅ (Already Done)
```bash
# Backend dependencies - ✅ INSTALLED
npm install

# Frontend dependencies - ✅ INSTALLED
cd admin-dashboard
npm install
```

### Step 2: Configure Email 📧 (REQUIRED - Do this now!)

#### 2.1 Generate Gmail App Password
1. **Go to:** https://myaccount.google.com/security
2. **Enable 2-Step Verification** if not already enabled
3. **Scroll down** to "App passwords"
4. **Click "App passwords"**
5. **Select:**
   - App: "Mail"
   - Device: "Other" → Type "IntelliSight"
6. **Click "Generate"**
7. **Copy the 16-character password** (looks like: `xxxx xxxx xxxx xxxx`)

#### 2.2 Update .env File
Open the file: `E:\FYP\Intellisight_FYP\new\Intellisight_FYP\.env`

Find these lines and update:
```env
# Email Configuration (Gmail SMTP)
EMAIL_USER="your-email@gmail.com"           ← Replace with your Gmail
EMAIL_PASS="xxxx xxxx xxxx xxxx"            ← Replace with the app password from step 2.1
ADMIN_EMAIL="admin@intellisight.com"        ← Replace with email to receive notifications

# Application URLs (usually don't need to change)
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
```

**Example:**
```env
EMAIL_USER="intellisight.system@gmail.com"
EMAIL_PASS="abcd efgh ijkl mnop"
ADMIN_EMAIL="myemail@example.com"
```

### Step 3: Start the Application 🚀

#### 3.1 Start Backend Server
```bash
# From project root directory
cd E:\FYP\Intellisight_FYP\new\Intellisight_FYP
npm run dev
```

You should see:
```
✅ Database connected successfully
🚀 Server running on port 3000
```

#### 3.2 Start Frontend (Open a new terminal)
```bash
cd E:\FYP\Intellisight_FYP\new\Intellisight_FYP\admin-dashboard
npm run dev
```

You should see:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

---

## 🎯 Test the Authentication System

### Test 1: User Registration
1. Open browser: http://localhost:5173/register
2. Fill in the form:
   - **Name:** Test User
   - **Email:** test@example.com
   - **Password:** TestPass123
   - **Confirm Password:** TestPass123
3. Click **"Sign Up"**
4. You should see: "Registration submitted successfully"

**Check your admin email** (the one you set as `ADMIN_EMAIL`)
- You should receive an email titled: "New User Registration Pending Approval"
- It will have two buttons: **Approve** and **Reject**

5. Click **"Approve"** in the email
6. Check the user's email (`test@example.com`) - they should receive a welcome email

### Test 2: Login
1. Go to http://localhost:5173/login
2. Enter:
   - **Email:** test@example.com
   - **Password:** TestPass123
3. Click **"Sign In"**
4. You should be redirected to the dashboard

### Test 3: Forgot Password
1. Go to http://localhost:5173/forgot-password
2. Enter email: test@example.com
3. Click **"Send Reset Link"**
4. Check the email inbox for password reset link
5. Click the link in the email
6. Enter new password (8-16 characters)
7. Click **"Reset Password"**
8. Login with the new password

---

## 🎨 What You'll See

### Registration Page
- Beautiful gradient background with floating icons
- Form with name, email, password fields
- Notice about admin approval requirement
- Animated transitions

### Login Page
- Futuristic design with glassmorphism
- Email and password fields
- "Forgot Password?" link
- "Create Account" link

### Forgot Password Page
- Clean, simple form
- Email input
- 15-minute expiry notice
- Links to login and signup

### Reset Password Page
- New password and confirm password fields
- Password visibility toggle
- Success message with auto-redirect

---

## 🔧 Troubleshooting

### ❌ "Email sending failed"
**Fix:**
1. Make sure you generated an **app password** (not your regular Gmail password)
2. Check `.env` file has correct `EMAIL_USER` and `EMAIL_PASS`
3. Verify 2-Step Verification is enabled on your Google account

### ❌ "Port 3000 already in use"
**Fix:**
```bash
netstat -ano | findstr :3000
taskkill //F //PID <PID_NUMBER>
npm run dev
```

### ❌ "Email already registered"
**Fix:** The email is already in use. Either:
- Use a different email
- Or delete the existing user from the database:
```bash
npx prisma studio
# Delete the record from Admin or PendingUsers table
```

### ❌ "Invalid or expired reset token"
**Fix:** Reset tokens expire after 15 minutes. Request a new reset link.

### ❌ "Emails going to spam"
**Check:**
1. Your spam folder first
2. Add the sender email to your contacts
3. Mark the email as "Not Spam"

---

## 📊 Quick Reference

### Default URLs:
- **Backend API:** http://localhost:3000/api
- **Frontend:** http://localhost:5173
- **Health Check:** http://localhost:3000/health

### Key Files:
- **Backend .env:** `E:\FYP\Intellisight_FYP\new\Intellisight_FYP\.env`
- **Database:** PostgreSQL on localhost:5000
- **Logs:** `E:\FYP\Intellisight_FYP\new\Intellisight_FYP\logs\app.log`

### Default Settings:
- **JWT Expiration:** 7 days
- **Password Requirements:** 8-16 characters
- **Reset Token Expiry:** 15 minutes
- **Bcrypt Rounds:** 10

---

## 📚 Full Documentation

For complete details, see:
- **EMAIL_SETUP.md** - Detailed email configuration guide
- **AUTHENTICATION_SYSTEM.md** - Complete authentication documentation
- **IMPLEMENTATION_SUMMARY.md** - What was implemented

---

## ✅ Checklist Before Testing

- [x] Backend dependencies installed
- [x] Frontend dependencies installed
- [x] Database migrations applied
- [x] Backend server running on port 3000
- [ ] Email configuration in .env file updated ← **DO THIS NOW!**
- [ ] Admin email configured
- [ ] Frontend running on port 5173

---

## 💡 Pro Tips

1. **Use a dedicated Gmail account** for the system (not your personal email)
2. **Save your app password** in a secure location
3. **Test with real email addresses** you have access to
4. **Check spam folders** if emails don't arrive
5. **Keep the backend terminal open** to see real-time logs

---

## 🎉 That's it!

You're now ready to use the authentication system. The setup is complete and everything is running!

**Need Help?**
- Check the troubleshooting section above
- Review the full documentation in `AUTHENTICATION_SYSTEM.md`
- Check server logs in `logs/app.log`

---

**Last Updated:** December 16, 2024  
**Status:** ✅ Backend Running | ⏳ Email Configuration Needed
