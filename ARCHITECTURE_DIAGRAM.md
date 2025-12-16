# Authentication System - Visual Flow Diagram

## 🎯 Complete Authentication Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INTELLISIGHT AUTHENTICATION SYSTEM                    │
│                                                                              │
│  Frontend (React)           Backend (Node.js)              Database (PostgreSQL)
│  Port: 5173                 Port: 3000                     Port: 5000       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📝 Flow 1: User Registration with Admin Approval

```
┌─────────────┐
│   User      │
│  Browser    │
└──────┬──────┘
       │ 1. Visits /register
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Register.jsx (Frontend)                        │
│  • Name input                                   │
│  • Email input                                  │
│  • Password input (8-16 chars)                  │
│  • Confirm password                             │
│  • "Admin approval required" notice             │
└──────┬──────────────────────────────────────────┘
       │ 2. POST /api/auth/register
       │    { name, email, password }
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.controller.js → register()                │
│  • Validates input                              │
│  • Calls auth.service.registerUser()            │
└──────┬──────────────────────────────────────────┘
       │ 3. Process registration
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.service.js → registerUser()               │
│  • Check if email exists in Admin table         │
│  • Check if email pending in PendingUsers       │
│  • Hash password with bcrypt                    │
│  • Generate verification token                  │
│  • Create record in PendingUsers table          │
│  • Send email to ADMIN_EMAIL                    │
└──────┬──────────────────────────────────────────┘
       │ 4. Insert into database
       │
       ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL - PendingUsers Table                │
│  ┌────────────────────────────────────────┐    │
│  │ Pending_ID: 1                          │    │
│  │ Name: "John Doe"                       │    │
│  │ Email: "john@example.com"              │    │
│  │ Password: "$2a$10$..."                 │    │
│  │ VerificationToken: "a1b2c3d4..."       │    │
│  │ Status: "PENDING"                      │    │
│  │ CreatedAt: 2024-12-16T...              │    │
│  └────────────────────────────────────────┘    │
└──────┬──────────────────────────────────────────┘
       │ 5. Email sent
       │
       ▼
┌─────────────────────────────────────────────────┐
│  📧 Email to Admin                              │
│  ┌────────────────────────────────────────┐    │
│  │ Subject: New User Registration         │    │
│  │                                        │    │
│  │ User: John Doe                         │    │
│  │ Email: john@example.com                │    │
│  │                                        │    │
│  │  [Approve] [Reject]                    │    │
│  │  (clickable buttons)                   │    │
│  └────────────────────────────────────────┘    │
└──────┬──────────────────────────────────────────┘
       │ 6. Admin clicks Approve
       │
       ▼
┌─────────────────────────────────────────────────┐
│  GET /api/auth/verify-user/:token/approve       │
│  auth.controller.js → verifyUser()              │
└──────┬──────────────────────────────────────────┘
       │ 7. Process approval
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.service.js → verifyUserRegistration()     │
│  • Find pending user by token                   │
│  • Create user in Admin table                   │
│  • Delete from PendingUsers                     │
│  • Send welcome email to user                   │
└──────┬──────────────────────────────────────────┘
       │ 8. Move to Admin table
       │
       ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL - Admin Table                       │
│  ┌────────────────────────────────────────┐    │
│  │ Admin_ID: 1                            │    │
│  │ Name: "John Doe"                       │    │
│  │ Email: "john@example.com"              │    │
│  │ Password: "$2a$10$..."                 │    │
│  │ Role: "ADMIN"                          │    │
│  │ CreatedAt: 2024-12-16T...              │    │
│  └────────────────────────────────────────┘    │
└──────┬──────────────────────────────────────────┘
       │ 9. Welcome email sent
       │
       ▼
┌─────────────────────────────────────────────────┐
│  📧 Email to User                               │
│  ┌────────────────────────────────────────┐    │
│  │ Subject: Registration Approved         │    │
│  │                                        │    │
│  │ Welcome to IntelliSight!               │    │
│  │ Your registration has been approved.   │    │
│  │                                        │    │
│  │ You can now login at:                  │    │
│  │ http://localhost:5173/login            │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## 🔐 Flow 2: User Login

```
┌─────────────┐
│   User      │
│  Browser    │
└──────┬──────┘
       │ 1. Visits /login
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Login.jsx (Frontend)                           │
│  • Email input                                  │
│  • Password input                               │
│  • Show/hide password toggle                    │
│  • "Forgot Password?" link                      │
└──────┬──────────────────────────────────────────┘
       │ 2. POST /api/auth/login
       │    { email, password }
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.controller.js → login()                   │
│  • Validates input                              │
│  • Calls auth.service.loginAdmin()              │
└──────┬──────────────────────────────────────────┘
       │ 3. Authenticate
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.service.js → loginAdmin()                 │
│  • Find user in Admin table by email           │
│  • Compare password with bcrypt                 │
│  • Generate JWT token                           │
│  • Token payload: { adminId, email, role }      │
│  • Token expires in 7 days                      │
└──────┬──────────────────────────────────────────┘
       │ 4. Return token + user data
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Response (JSON)                                │
│  {                                              │
│    "success": true,                             │
│    "message": "Login successful",               │
│    "data": {                                    │
│      "admin": { ... },                          │
│      "token": "eyJhbGciOi..."                   │
│    }                                            │
│  }                                              │
└──────┬──────────────────────────────────────────┘
       │ 5. Store in AuthContext
       │
       ▼
┌─────────────────────────────────────────────────┐
│  AuthContext (Frontend State)                   │
│  • Stores user data                             │
│  • Stores JWT token                             │
│  • Axios interceptor adds token to requests     │
│  • localStorage persistence                     │
└──────┬──────────────────────────────────────────┘
       │ 6. Redirect
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Dashboard (Protected Route)                    │
│  User is now logged in!                         │
└─────────────────────────────────────────────────┘
```

---

## 🔑 Flow 3: Forgot Password

```
┌─────────────┐
│   User      │
│  Browser    │
└──────┬──────┘
       │ 1. Visits /forgot-password
       │
       ▼
┌─────────────────────────────────────────────────┐
│  ForgotPassword.jsx (Frontend)                  │
│  • Email input                                  │
│  • "15-minute expiry" notice                    │
└──────┬──────────────────────────────────────────┘
       │ 2. POST /api/auth/forgot-password
       │    { email }
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.controller.js → forgotPasswordHandler()   │
│  • Validates email                              │
│  • Calls auth.service.forgotPassword()          │
└──────┬──────────────────────────────────────────┘
       │ 3. Generate reset token
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.service.js → forgotPassword()             │
│  • Check if email exists in Admin table         │
│  • Generate random token (crypto)               │
│  • Set expiry: 15 minutes from now              │
│  • Save to PasswordResets table                 │
│  • Send email with reset link                   │
└──────┬──────────────────────────────────────────┘
       │ 4. Insert into database
       │
       ▼
┌─────────────────────────────────────────────────┐
│  PostgreSQL - PasswordResets Table              │
│  ┌────────────────────────────────────────┐    │
│  │ Reset_ID: 1                            │    │
│  │ Email: "john@example.com"              │    │
│  │ Token: "xyz123abc456..."               │    │
│  │ ExpiresAt: 2024-12-16T19:30:00        │    │
│  │ Used: false                            │    │
│  │ CreatedAt: 2024-12-16T19:15:00        │    │
│  └────────────────────────────────────────┘    │
└──────┬──────────────────────────────────────────┘
       │ 5. Email sent
       │
       ▼
┌─────────────────────────────────────────────────┐
│  📧 Email to User                               │
│  ┌────────────────────────────────────────┐    │
│  │ Subject: Password Reset Request        │    │
│  │                                        │    │
│  │ Click the link below to reset your     │    │
│  │ password. This link expires in 15 min. │    │
│  │                                        │    │
│  │ [Reset Password]                       │    │
│  │ http://localhost:5173/reset-password/  │    │
│  │ xyz123abc456...                        │    │
│  └────────────────────────────────────────┘    │
└──────┬──────────────────────────────────────────┘
       │ 6. User clicks link
       │
       ▼
┌─────────────────────────────────────────────────┐
│  ResetPassword.jsx (Frontend)                   │
│  • Token extracted from URL params              │
│  • New password input                           │
│  • Confirm password input                       │
│  • Show/hide password toggles                   │
└──────┬──────────────────────────────────────────┘
       │ 7. POST /api/auth/reset-password/:token
       │    { password }
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.controller.js → resetPasswordHandler()    │
│  • Validates password                           │
│  • Calls auth.service.resetPassword()           │
└──────┬──────────────────────────────────────────┘
       │ 8. Validate token & update password
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.service.js → resetPassword()              │
│  • Find token in PasswordResets table           │
│  • Check if token is expired                    │
│  • Check if token is already used               │
│  • Hash new password                            │
│  • Update password in Admin table               │
│  • Mark token as used                           │
└──────┬──────────────────────────────────────────┘
       │ 9. Success response
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Success Page (ResetPassword.jsx)               │
│  ✅ Password Reset Successful!                  │
│  Redirecting to login...                        │
└──────┬──────────────────────────────────────────┘
       │ 10. Auto-redirect after 2 seconds
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Login Page                                     │
│  User can now login with new password           │
└─────────────────────────────────────────────────┘
```

---

## 🛡️ Protected Routes Flow

```
┌─────────────┐
│   User      │
│  Browser    │
└──────┬──────┘
       │ Tries to access /dashboard
       │
       ▼
┌─────────────────────────────────────────────────┐
│  ProtectedRoute.jsx (Frontend)                  │
│  • Checks if user is authenticated              │
│  • Checks AuthContext for token                 │
└──────┬──────────────────────────────────────────┘
       │
       │  ┌─────────────────────────┐
       │  │ If NOT authenticated:   │
       │  │ → Redirect to /login    │
       │  │ → Save intended route   │
       │  └─────────────────────────┘
       │
       │  ┌─────────────────────────┐
       │  │ If authenticated:       │
       │  │ → Allow access          │
       │  │ → Render component      │
       │  └─────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Any API Request from Frontend                  │
│  Axios interceptor adds JWT token to header     │
│  Authorization: Bearer eyJhbGciOi...            │
└──────┬──────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  auth.js → authenticateToken() middleware       │
│  • Extract token from Authorization header      │
│  • Verify token with JWT_SECRET                 │
│  • Decode payload (adminId, email, role)        │
│  • Attach user info to req.user                 │
└──────┬──────────────────────────────────────────┘
       │
       │  ┌─────────────────────────┐
       │  │ If token invalid:       │
       │  │ → 401 Unauthorized      │
       │  │ → Frontend redirects    │
       │  └─────────────────────────┘
       │
       │  ┌─────────────────────────┐
       │  │ If token valid:         │
       │  │ → Continue to route     │
       │  │ → Access granted        │
       │  └─────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────┐
│  Protected Resource / API Endpoint              │
│  User can access the requested resource         │
└─────────────────────────────────────────────────┘
```

---

## 📊 Database Tables Relationship

```
┌────────────────────────────────┐
│         Admin Table            │
│  (Approved Users)              │
│  ┌──────────────────────────┐ │
│  │ Admin_ID (PK)            │ │
│  │ Name                     │ │
│  │ Email (UNIQUE)           │ │
│  │ Password (HASHED)        │ │
│  │ Role                     │ │
│  │ CreatedAt                │ │
│  │ UpdatedAt                │ │
│  └──────────────────────────┘ │
└────────────┬───────────────────┘
             │
             │ Users login here
             │
             │
┌────────────┴───────────────────┐
│      PendingUsers Table        │
│  (Awaiting Approval)           │
│  ┌──────────────────────────┐ │
│  │ Pending_ID (PK)          │ │
│  │ Name                     │ │
│  │ Email (UNIQUE)           │ │
│  │ Password (HASHED)        │ │
│  │ VerificationToken        │ │
│  │ Status (PENDING)         │ │
│  │ CreatedAt                │ │
│  └──────────────────────────┘ │
└────────────┬───────────────────┘
             │
             │ After approval → Moved to Admin
             │ After rejection → Deleted
             │
             │
┌────────────┴───────────────────┐
│    PasswordResets Table        │
│  (Reset Tokens)                │
│  ┌──────────────────────────┐ │
│  │ Reset_ID (PK)            │ │
│  │ Email                    │ │
│  │ Token (UNIQUE)           │ │
│  │ ExpiresAt                │ │
│  │ Used (Boolean)           │ │
│  │ CreatedAt                │ │
│  └──────────────────────────┘ │
└────────────────────────────────┘
```

---

## 🔐 Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                       │
└─────────────────────────────────────────────────────────┘

1. Password Hashing
   ┌──────────────────────────────────────────┐
   │ Plain Password → bcrypt (10 rounds)      │
   │ → Hashed Password                        │
   │ → Stored in database                     │
   └──────────────────────────────────────────┘

2. JWT Token
   ┌──────────────────────────────────────────┐
   │ User Data + Secret Key → JWT Token       │
   │ → Signed with HS256                      │
   │ → Expires in 7 days                      │
   │ → Sent with each request                 │
   └──────────────────────────────────────────┘

3. Email Verification
   ┌──────────────────────────────────────────┐
   │ crypto.randomBytes(32) → Unique Token    │
   │ → Stored in database                     │
   │ → Sent via email                         │
   │ → Single use only                        │
   └──────────────────────────────────────────┘

4. Token Expiry
   ┌──────────────────────────────────────────┐
   │ Reset Token → 15 minutes                 │
   │ JWT Token → 7 days                       │
   │ After expiry → Invalid                   │
   └──────────────────────────────────────────┘

5. SQL Injection Prevention
   ┌──────────────────────────────────────────┐
   │ Prisma ORM → Parameterized Queries       │
   │ → Safe database operations               │
   └──────────────────────────────────────────┘

6. XSS Prevention
   ┌──────────────────────────────────────────┐
   │ React → Auto-escapes output              │
   │ → Prevents script injection              │
   └──────────────────────────────────────────┘
```

---

## 🎨 Frontend Components Tree

```
App.jsx
├── AuthProvider (Context)
│   ├── Stores: user, token, isAuthenticated
│   └── Methods: login(), logout(), register()
│
├── Public Routes
│   ├── Login.jsx
│   │   └── Form: email, password
│   ├── Register.jsx
│   │   └── Form: name, email, password, confirmPassword
│   ├── ForgotPassword.jsx
│   │   └── Form: email
│   └── ResetPassword.jsx (/:token)
│       └── Form: password, confirmPassword
│
└── Protected Routes (ProtectedRoute wrapper)
    ├── Dashboard.jsx
    ├── Students.jsx
    ├── Teachers.jsx
    ├── Zones.jsx
    └── ... (other pages)
```

---

## 📡 API Endpoints Summary

```
PUBLIC ENDPOINTS (No Auth Required)
├── POST   /api/auth/register
├── POST   /api/auth/login
├── GET    /api/auth/verify-user/:token/:action
├── POST   /api/auth/forgot-password
└── POST   /api/auth/reset-password/:token

PROTECTED ENDPOINTS (JWT Required)
├── GET    /api/auth/me
├── POST   /api/auth/logout
├── GET    /api/auth/pending-users
└── POST   /api/auth/register-admin (Admin only)
```

---

## 📬 Email Templates

```
┌─────────────────────────────────────────────┐
│  1. Admin Approval Notification             │
│  ────────────────────────────────────       │
│  To: ADMIN_EMAIL                            │
│  Subject: New User Registration Pending     │
│                                             │
│  User: [Name]                               │
│  Email: [Email]                             │
│                                             │
│  [Approve] [Reject]                         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  2. User Approval Email                     │
│  ────────────────────────────────────────   │
│  To: [User Email]                           │
│  Subject: Registration Approved             │
│                                             │
│  Welcome to IntelliSight!                   │
│  Your registration has been approved.       │
│                                             │
│  Login: http://localhost:5173/login         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  3. User Rejection Email                    │
│  ────────────────────────────────────────   │
│  To: [User Email]                           │
│  Subject: Registration Request Update       │
│                                             │
│  Your registration has been reviewed.       │
│  Unfortunately, we cannot approve it.       │
│                                             │
│  Contact: ADMIN_EMAIL                       │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  4. Password Reset Email                    │
│  ────────────────────────────────────────   │
│  To: [User Email]                           │
│  Subject: Password Reset Request            │
│                                             │
│  Click to reset (expires in 15 min):       │
│  [Reset Password]                           │
│                                             │
│  Link: /reset-password/[token]              │
└─────────────────────────────────────────────┘
```

---

## 🚀 System Status

```
✅ Backend Server:     http://localhost:3000
✅ Frontend Dashboard: http://localhost:5173
✅ Database:           PostgreSQL on localhost:5000
✅ Health Check:       http://localhost:3000/health
✅ API Base:           http://localhost:3000/api

📊 Tables Created:
   ✅ Admin
   ✅ PendingUsers
   ✅ PasswordResets
   ✅ Students
   ✅ Teachers
   ✅ Zones
   ✅ Cameras

🔧 Required Configuration:
   ⏳ EMAIL_USER (Gmail address)
   ⏳ EMAIL_PASS (App password)
   ⏳ ADMIN_EMAIL (Notification email)
```

---

**This visual guide provides a complete overview of the authentication system architecture and workflows.**
