# Email Configuration Setup Guide

This guide explains how to set up email functionality for the IntelliSight authentication system.

## Overview

The authentication system uses email for:
1. **Admin Approval Notifications** - Notifying admins when new users register
2. **User Approval/Rejection Notifications** - Informing users about their registration status
3. **Password Reset** - Sending password reset links to users

## Gmail SMTP Configuration

### Prerequisites
- A Gmail account
- Two-factor authentication (2FA) enabled on your Google account

### Step 1: Enable 2-Factor Authentication

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Navigate to **Security** > **2-Step Verification**
3. Follow the prompts to enable 2FA

### Step 2: Generate App-Specific Password

1. After enabling 2FA, go back to [Google Account Security](https://myaccount.google.com/security)
2. Scroll down to **2-Step Verification**
3. At the bottom, find **App passwords**
4. Click on **App passwords**
5. Select:
   - App: **Mail**
   - Device: **Other (Custom name)** → Enter "IntelliSight"
6. Click **Generate**
7. Google will display a 16-character password
8. **Copy this password** - you won't be able to see it again

### Step 3: Update .env File

Open the `.env` file in the root directory and update these variables:

```env
# Email Configuration (Gmail SMTP)
EMAIL_USER="your-email@gmail.com"           # Your Gmail address
EMAIL_PASS="xxxx xxxx xxxx xxxx"            # The 16-character app password from Step 2
ADMIN_EMAIL="admin@intellisight.com"        # Email where admin notifications will be sent

# Application URLs
FRONTEND_URL="http://localhost:5173"        # Your React frontend URL
BACKEND_URL="http://localhost:3000"         # Your backend API URL
```

**Example:**
```env
EMAIL_USER="intellisight.system@gmail.com"
EMAIL_PASS="abcd efgh ijkl mnop"
ADMIN_EMAIL="admin@intellisight.com"
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"
```

### Step 4: Restart Server

After updating the `.env` file, restart your backend server:

```bash
npm run dev
```

## Testing Email Functionality

### Test Registration Email
1. Navigate to `http://localhost:5173/register`
2. Fill in the registration form
3. Check the `ADMIN_EMAIL` inbox for approval notification

### Test Password Reset Email
1. Navigate to `http://localhost:5173/forgot-password`
2. Enter your email address
3. Check your inbox for the password reset link

## Email Templates

### 1. Admin Approval Notification
Sent to admin when a user registers:
- **Subject:** New User Registration Pending Approval
- **Content:** User details with Approve/Reject links
- **Action Links:** 
  - Approve: `{BACKEND_URL}/api/auth/verify-user/{token}/approve`
  - Reject: `{BACKEND_URL}/api/auth/verify-user/{token}/reject`

### 2. User Approval Email
Sent to user after admin approves:
- **Subject:** Registration Approved - Welcome to IntelliSight
- **Content:** Welcome message with login instructions
- **Action:** User can now login at `{FRONTEND_URL}/login`

### 3. User Rejection Email
Sent to user after admin rejects:
- **Subject:** Registration Request Update
- **Content:** Rejection notification with admin contact info

### 4. Password Reset Email
Sent when user requests password reset:
- **Subject:** Password Reset Request
- **Content:** Reset link valid for 15 minutes
- **Action Link:** `{FRONTEND_URL}/reset-password/{token}`

## Troubleshooting

### Error: "Invalid login: 535-5.7.8 Username and Password not accepted"
**Solution:** Make sure you're using an app-specific password, not your regular Gmail password.

### Error: "self signed certificate in certificate chain"
**Solution:** Add this to your nodemailer configuration:
```javascript
tls: {
  rejectUnauthorized: false
}
```

### Emails not being sent
1. Verify `EMAIL_USER` and `EMAIL_PASS` are correct in `.env`
2. Check if 2FA is enabled on your Google account
3. Ensure the app password is copied correctly (no spaces)
4. Check server logs for error messages
5. Verify the server has internet connectivity

### Emails going to spam
1. Use a real domain email instead of Gmail in production
2. Set up SPF, DKIM, and DMARC records for your domain
3. Use a dedicated email service like SendGrid or AWS SES for production

## Production Deployment

For production environments, consider using dedicated email services:

### Option 1: SendGrid
```javascript
const emailConfig = {
  host: 'smtp.sendgrid.net',
  port: 587,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
};
```

### Option 2: AWS SES
```javascript
const emailConfig = {
  host: 'email-smtp.us-east-1.amazonaws.com',
  port: 587,
  auth: {
    user: process.env.AWS_SES_USERNAME,
    pass: process.env.AWS_SES_PASSWORD
  }
};
```

### Option 3: Mailgun
```javascript
const emailConfig = {
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_USERNAME,
    pass: process.env.MAILGUN_PASSWORD
  }
};
```

## Security Best Practices

1. **Never commit .env file** - Ensure `.env` is in `.gitignore`
2. **Use environment-specific variables** - Different configs for dev/staging/production
3. **Rotate passwords regularly** - Change app passwords periodically
4. **Use dedicated email account** - Don't use personal email for system notifications
5. **Enable email rate limiting** - Prevent abuse of registration/reset endpoints
6. **Validate email addresses** - Ensure only valid email formats are accepted
7. **Set expiration on reset tokens** - Currently set to 15 minutes

## Email Rate Limiting (Recommended)

To prevent spam and abuse, implement rate limiting:

```javascript
import rateLimit from 'express-rate-limit';

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // limit each IP to 3 requests per windowMs
  message: 'Too many email requests, please try again later'
});

// Apply to email routes
router.post('/forgot-password', emailLimiter, forgotPasswordHandler);
router.post('/register', emailLimiter, register);
```

## Support

For issues with email configuration:
1. Check server logs: `logs/app.log`
2. Verify environment variables are loaded
3. Test SMTP connection manually
4. Contact system administrator

---

**Last Updated:** December 2024
**Version:** 1.0.0
