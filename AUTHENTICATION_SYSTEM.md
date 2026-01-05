# Authentication System Documentation

## Overview

The IntelliSight authentication system implements a secure, email-based user registration flow with admin approval. This ensures only authorized users can access the system.

## Features

✅ **User Registration** - Sign up with name, email, and password  
✅ **Admin Approval Workflow** - All registrations require admin approval  
✅ **Email Notifications** - Automated emails for approval, rejection, and password reset  
✅ **Password Reset** - Secure token-based password recovery  
✅ **JWT Authentication** - Stateless session management  
✅ **Role-Based Access** - Admin and user roles  
✅ **React Frontend** - Modern, animated UI with TailwindCSS  

## User Journey

### 1. Registration Flow

```
User fills registration form
       ↓
User clicks "Sign Up"
       ↓
Data saved to PendingUsers table (status: PENDING)
       ↓
Email sent to ADMIN_EMAIL with Approve/Reject links
       ↓
Admin clicks Approve or Reject in email
       ↓
[If Approved]                    [If Rejected]
  → User moved to Admin table      → User deleted from PendingUsers
  → Welcome email sent to user     → Rejection email sent to user
  → User can now login             → User must register again
```

### 2. Login Flow

```
User enters email and password
       ↓
Credentials validated against Admin table
       ↓
[If Valid]                       [If Invalid]
  → JWT token generated            → Error message displayed
  → User redirected to dashboard   → User remains on login page
  → Token stored in AuthContext
```

### 3. Forgot Password Flow

```
User clicks "Forgot Password"
       ↓
User enters email address
       ↓
Token generated and saved to PasswordResets table
       ↓
Email sent with reset link (valid 15 minutes)
       ↓
User clicks link in email
       ↓
User enters new password
       ↓
Password updated in Admin table
       ↓
Token marked as used
       ↓
User redirected to login page
```

## API Endpoints

### Public Endpoints

#### POST `/api/auth/register`
Register a new user (creates pending approval request)

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john.doe@university.edu",
  "password": "SecurePass123",
  "confirmPassword": "SecurePass123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Registration submitted successfully. Please wait for admin approval.",
  "data": {
    "email": "john.doe@university.edu"
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Email already registered or pending approval"
}
```

---

#### POST `/api/auth/login`
Authenticate user and receive JWT token

**Request Body:**
```json
{
  "email": "john.doe@university.edu",
  "password": "SecurePass123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "admin": {
      "Admin_ID": 1,
      "Name": "John Doe",
      "Email": "john.doe@university.edu",
      "Role": "ADMIN"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

---

#### POST `/api/auth/forgot-password`
Request password reset email

**Request Body:**
```json
{
  "email": "john.doe@university.edu"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password reset email sent. Please check your inbox."
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "No account found with this email address"
}
```

---

#### POST `/api/auth/reset-password/:token`
Reset password using token from email

**URL Parameters:**
- `token` - Reset token from email link

**Request Body:**
```json
{
  "password": "NewSecurePass123"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Password has been reset successfully. You can now login with your new password."
}
```

**Response (Error):**
```json
{
  "success": false,
  "message": "Invalid or expired reset token"
}
```

---

#### GET `/api/auth/verify-user/:token/:action`
Admin action link from email (approve or reject)

**URL Parameters:**
- `token` - Verification token
- `action` - Either `approve` or `reject`

**Response:**
Returns HTML page with success/rejection message (not JSON)

---

### Protected Endpoints (Require JWT Token)

#### GET `/api/auth/me`
Get current authenticated user information

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "admin": {
      "Admin_ID": 1,
      "Name": "John Doe",
      "Email": "john.doe@university.edu",
      "Role": "ADMIN"
    }
  }
}
```

---

#### POST `/api/auth/logout`
Logout user (client-side token removal)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

#### GET `/api/auth/pending-users`
Get list of pending user approvals (Admin only)

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "pendingUsers": [
      {
        "Pending_ID": 1,
        "Name": "Jane Smith",
        "Email": "jane.smith@university.edu",
        "Status": "PENDING",
        "CreatedAt": "2024-12-16T10:30:00.000Z"
      }
    ]
  }
}
```

---

## Frontend Routes

### Authentication Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/login` | Login.jsx | User login page |
| `/register` | Register.jsx | New user registration |
| `/forgot-password` | ForgotPassword.jsx | Request password reset |
| `/reset-password/:token` | ResetPassword.jsx | Reset password with token |

### Protected Pages (Require Authentication)

| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard` | Dashboard.jsx | Main dashboard |
| `/students` | Students.jsx | Student management |
| `/teachers` | Teachers.jsx | Teacher management |
| `/zones` | Zones.jsx | Zone monitoring |
| `/cameras` | Cameras.jsx | Camera management |

## Database Schema

### Admin Table
Stores approved users who can access the system

```prisma
model Admin {
  Admin_ID Int      @id @default(autoincrement())
  Name     String
  Email    String   @unique
  Password String
  Role     String   @default("ADMIN")
  CreatedAt DateTime @default(now())
  UpdatedAt DateTime @updatedAt
}
```

### PendingUsers Table
Temporary storage for registration requests awaiting approval

```prisma
model PendingUsers {
  Pending_ID        Int      @id @default(autoincrement())
  Name              String
  Email             String   @unique
  Password          String
  VerificationToken String   @unique
  Status            String   @default("PENDING")
  CreatedAt         DateTime @default(now())
}
```

### PasswordResets Table
Stores password reset tokens

```prisma
model PasswordResets {
  Reset_ID  Int      @id @default(autoincrement())
  Email     String
  Token     String   @unique
  ExpiresAt DateTime
  Used      Boolean  @default(false)
  CreatedAt DateTime @default(now())
}
```

## Security Features

### Password Requirements
- Minimum length: 8 characters
- Maximum length: 16 characters
- Hashed with bcrypt (10 rounds)

### JWT Tokens
- Secret key: Stored in environment variable
- Expiration: 7 days (configurable)
- Payload includes: Admin_ID, Email, Role

### Email Verification
- Unique tokens generated with crypto.randomBytes
- Reset tokens expire after 15 minutes
- Tokens can only be used once

### SQL Injection Prevention
- Prisma ORM with parameterized queries
- Input validation on all endpoints

### XSS Prevention
- Content-Type headers set correctly
- React auto-escapes output

## Environment Variables

Required variables in `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@host:port/database"

# JWT
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# Bcrypt
BCRYPT_ROUNDS=10

# Email (Gmail SMTP)
EMAIL_USER="your-email@gmail.com"
EMAIL_PASS="your-app-password"
ADMIN_EMAIL="admin@intellisight.com"

# Application URLs
FRONTEND_URL="http://localhost:5173"
BACKEND_URL="http://localhost:3000"

# Server
PORT=3000
NODE_ENV="development"
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Backend
npm install

# Frontend
cd admin-dashboard
npm install
```

### 2. Database Setup

```bash
# Run migrations
npx prisma migrate dev

# Generate Prisma Client
npx prisma generate
```

### 3. Configure Email

Follow the [EMAIL_SETUP.md](./EMAIL_SETUP.md) guide to set up Gmail SMTP.

### 4. Start Services

```bash
# Start backend (from root)
npm run dev

# Start frontend (from admin-dashboard)
cd admin-dashboard
npm run dev
```

### 5. Create First Admin (Optional)

If you need to create an admin without approval:

```bash
# Run in Prisma Studio
npx prisma studio

# Or use the register-admin endpoint (requires existing admin authentication)
POST /api/auth/register-admin
```

## Testing the Authentication Flow

### Test User Registration

1. Open `http://localhost:5173/register`
2. Fill in the form:
   - Name: Test User
   - Email: test@university.edu
   - Password: TestPass123
   - Confirm Password: TestPass123
3. Click "Sign Up"
4. Check admin email inbox for approval notification
5. Click "Approve" or "Reject" in the email
6. Check user email for approval/rejection notification
7. If approved, login at `http://localhost:5173/login`

### Test Password Reset

1. Open `http://localhost:5173/forgot-password`
2. Enter registered email address
3. Check email inbox for reset link
4. Click the reset link
5. Enter new password (8-16 characters)
6. Submit and verify redirect to login
7. Login with new password

### Test Protected Routes

1. Try accessing `http://localhost:5173/dashboard` without logging in
2. Verify redirect to login page
3. Login with credentials
4. Verify access to dashboard and other protected routes
5. Logout and verify redirect to login

## Troubleshooting

### Issue: "Email already registered or pending approval"
**Solution:** Check PendingUsers table for existing record. Delete if necessary:
```sql
DELETE FROM "PendingUsers" WHERE "Email" = 'user@example.com';
```

### Issue: "Invalid or expired reset token"
**Solution:** Tokens expire after 15 minutes. Request a new reset link.

### Issue: "Invalid email or password"
**Solution:** Ensure user has been approved by admin and exists in Admin table.

### Issue: Emails not being sent
**Solution:** Check [EMAIL_SETUP.md](./EMAIL_SETUP.md) and verify:
- EMAIL_USER and EMAIL_PASS are correct
- Gmail app password is generated
- Server has internet connectivity

### Issue: JWT token expired
**Solution:** Login again to get a new token. Adjust JWT_EXPIRES_IN if needed.

## Development Notes

### File Structure

```
src/
├── controllers/
│   └── auth.controller.js      # HTTP request handlers
├── services/
│   └── auth.service.js         # Business logic
├── routes/
│   └── auth.routes.js          # Route definitions
├── middlewares/
│   └── auth.js                 # JWT verification middleware
└── utils/
    └── errors.js               # Custom error classes

admin-dashboard/src/
├── pages/
│   ├── Login.jsx
│   ├── Register.jsx
│   ├── ForgotPassword.jsx
│   └── ResetPassword.jsx
├── context/
│   └── AuthContext.jsx         # Authentication state management
└── components/
    └── ProtectedRoute.jsx      # Route protection wrapper
```

### Adding New Protected Routes

1. Create the page component
2. Add route in `App.jsx` wrapped with `<ProtectedRoute>`
3. Optionally add role-based checks in middleware

Example:
```jsx
<Route
  path="/new-page"
  element={
    <ProtectedRoute>
      <Layout>
        <NewPage />
      </Layout>
    </ProtectedRoute>
  }
/>
```

## Future Enhancements

- [ ] Email verification on registration (verify email ownership)
- [ ] Rate limiting on authentication endpoints
- [ ] Account lockout after failed login attempts
- [ ] Two-factor authentication (2FA)
- [ ] Social login (Google, Microsoft)
- [ ] Password strength meter on registration
- [ ] Remember me functionality
- [ ] Session management (revoke tokens)
- [ ] Admin dashboard for user management
- [ ] Audit logs for authentication events

## Support

For issues or questions:
1. Check this documentation
2. Review [EMAIL_SETUP.md](./EMAIL_SETUP.md)
3. Check server logs: `logs/app.log`
4. Contact system administrator

---

**Last Updated:** December 2024  
**Version:** 2.0.0
