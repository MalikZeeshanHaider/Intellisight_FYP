# Super Admin Access

## Super Admin Credentials

The super admin account is hardcoded in the application and **not stored in the database**. This provides an additional layer of security and ensures there's always a way to manage the system.

### Default Credentials

```
Email: superadmin@intellisight.com
Password: SuperAdmin@123
```

**⚠️ IMPORTANT: Change these credentials in production!**

## How to Change Super Admin Credentials

1. Open the `.env` file in the project root
2. Update the following variables:

```env
SUPER_ADMIN_EMAIL="your-super-admin-email@example.com"
SUPER_ADMIN_PASSWORD="YourSecurePassword123!"
SUPER_ADMIN_NAME="Your Super Admin Name"
```

3. Restart the backend server for changes to take effect

## Super Admin Features

The super admin has all regular admin functionalities plus:

### 1. **Dashboard Statistics**
   - View total number of users in the system
   - See pending approval count
   - Track approved users
   - Monitor admin users

### 2. **User Management**
   - **Approve Users**: Approve pending registration requests directly from the dashboard
   - **Reject Users**: Reject registration requests with optional reason
   - **View All Users**: See complete list of all admins in the system
   - **Delete Users**: Remove admin accounts from the system

### 3. **Direct Access**
   - Access via: `http://localhost:3001/super-admin`
   - Automatically redirected to super admin dashboard after login
   - Cannot be accessed by regular admins

## API Endpoints (Super Admin Only)

All super admin endpoints require authentication token and super admin role:

```
GET  /api/auth/admin/statistics        - Get system statistics
GET  /api/auth/admin/all               - Get all admins
POST /api/auth/admin/approve/:userId   - Approve pending user
POST /api/auth/admin/reject/:userId    - Reject pending user
DELETE /api/auth/admin/:adminId        - Delete admin user
```

## Security Notes

1. **Credentials Storage**: Super admin credentials are stored in environment variables, not in the database
2. **Token-based Auth**: Super admin still uses JWT tokens like regular admins
3. **Role Verification**: Backend validates super admin role on protected endpoints
4. **Single Account**: Only one super admin account exists (configured in .env)

## Login Flow

1. User enters super admin credentials on login page
2. Backend checks credentials against environment variables
3. If match, creates JWT token with `isSuperAdmin: true` flag
4. User is redirected to `/super-admin` dashboard
5. Regular users redirected to `/dashboard`

## Troubleshooting

**Problem**: Cannot login with super admin credentials
- **Solution**: Verify `.env` file has correct credentials
- **Solution**: Restart backend server after changing .env

**Problem**: Super admin redirected to regular dashboard
- **Solution**: Clear browser localStorage and login again
- **Solution**: Check if `isSuperAdmin` flag is set in token

**Problem**: Cannot access super admin endpoints
- **Solution**: Verify token includes `isSuperAdmin: true`
- **Solution**: Check middleware is properly validating super admin role
