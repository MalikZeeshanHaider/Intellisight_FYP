# IntelliSight Admin Dashboard

<div align="center">

![IntelliSight Logo](https://via.placeholder.com/150x150/0ea5e9/ffffff?text=IS)

**Real-time Zone Tracking Dashboard for Students & Teachers**

[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0.7-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.3.6-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Screenshots](#screenshots)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Integration](#api-integration)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)

---

## 🌟 Overview

IntelliSight Admin Dashboard is a modern, real-time web application for tracking student and teacher movements across different zones using facial recognition technology. Built with React and connected to a Node.js backend, it provides administrators with live insights into building occupancy and zone-based tracking.

### Key Highlights

✅ **Real-time Tracking** - Live zone occupancy updates every 5 seconds  
✅ **Modern UI/UX** - Clean, responsive design matching the reference mockup  
✅ **JWT Authentication** - Secure admin login with token-based auth  
✅ **Zone Management** - View and manage multiple tracking zones  
✅ **Activity Logs** - Complete history of movements and zone changes  
✅ **Student/Teacher Management** - View all registered persons  

---

## ✨ Features

### 🎯 Dashboard
- **Statistics Cards** - Total students, teachers, active persons, and zones
- **Recent Activity Feed** - Last 10 zone tracking events
- **Zone Overview** - Real-time occupancy for all zones
- **Auto-refresh** - Updates every 5 seconds without manual reload

### 🗺️ Zone Tracking
- **Zone List** - View all configured zones with live person counts
- **Zone Details** - Detailed view of persons in each zone
- **Entry Time Tracking** - See when each person entered the zone
- **Duration Calculation** - Automatic time spent in zone

### 👥 Person Management
- **Students Page** - Complete list with search functionality
- **Teachers Page** - Faculty directory with filtering
- **Search & Filter** - Find persons by name, email, or ID

### 📊 Activity Logs
- **Movement History** - Complete log of all zone tracking events
- **Filtering Options** - View last 25, 50, or 100 entries
- **Auto-refresh** - Real-time log updates

### 🔐 Authentication
- **Secure Login** - JWT token-based authentication
- **Protected Routes** - Auto-redirect to login if not authenticated
- **Session Management** - Persistent login with localStorage

---

## 📸 Screenshots

### Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  IntelliSight Dashboard                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ 210     │  │ 21      │  │ 45      │  │ 4       │          │
│  │Students │  │Teachers │  │ Active  │  │ Zones   │          │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘          │
│                                                                 │
│  Recent Activity          │  Zone Overview                     │
│  ┌──────────────────────┐ │  ┌──────────────────┐            │
│  │ Abdullah Ozair  Lab  │ │  │ Zone 1      25   │            │
│  │ Zainab         301   │ │  │ Zone 2      61   │            │
│  │ Zeeshan      Library │ │  │ Zone 3      10   │            │
│  └──────────────────────┘ │  └──────────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

### Frontend
- **React 18.2** - UI library
- **Vite 5.0** - Build tool and dev server
- **React Router 6.20** - Client-side routing
- **TailwindCSS 3.3** - Utility-first CSS framework

### State Management & Data Fetching
- **React Context API** - Authentication state
- **Axios 1.6** - HTTP client for API calls
- **Real-time Polling** - 5-second intervals for live updates

### UI Components & Icons
- **React Icons 4.12** - Icon library
- **Recharts 2.10** - Charts (optional for analytics)
- **date-fns 3.0** - Date formatting

### Backend Integration
- **Node.js API** - REST API backend
- **JWT Authentication** - Bearer token auth
- **PostgreSQL** - Database (via backend)

---

## 🚀 Installation

### Prerequisites
- **Node.js 16+** installed
- **npm** or **yarn** package manager
- **IntelliSight Backend** running on `http://localhost:3000`

### Step 1: Clone the Repository
```bash
cd admin-dashboard
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Create Environment File
```bash
copy .env.example .env
```

### Step 4: Configure Environment Variables
Edit `.env` file:
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_POLLING_INTERVAL=5000
```

### Step 5: Start Development Server
```bash
npm run dev
```

The dashboard will open at `http://localhost:3001`

---

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_BASE_URL` | Backend API base URL | `http://localhost:3000/api` |
| `VITE_POLLING_INTERVAL` | Real-time update interval (ms) | `5000` |

### API Endpoints Used

The dashboard connects to these backend endpoints:

```
Authentication:
POST   /api/auth/login              # Admin login

Zones:
GET    /api/zones                   # Get all zones
GET    /api/zones/:id               # Get zone details
GET    /api/timetable/zone/:id/persons  # Get persons in zone

Students:
GET    /api/students                # Get all students
GET    /api/students/:id            # Get student details

Teachers:
GET    /api/teachers                # Get all teachers
GET    /api/teachers/:id            # Get teacher details

Timetable/Tracking:
GET    /api/timetable/active        # Get active persons
GET    /api/timetable/recent        # Get recent activity
```

---

## 📖 Usage

### 1. Login to Dashboard

**Default Admin Credentials:**
```
Email: john.admin@intellisight.com
Password: admin123
```

### 2. View Dashboard

After login, you'll see:
- Total statistics (students, teachers, active persons, zones)
- Recent activity feed
- Zone overview with live counts

### 3. Navigate Between Pages

Use the sidebar to access:
- **Dashboard** - Main overview
- **Students** - Student directory
- **Teachers** - Teacher directory
- **Zones** - Zone management
- **Logs** - Activity history
- **Settings** - Configuration

### 4. View Zone Details

Click on any zone card to see:
- Persons currently in the zone
- Entry times
- Duration in zone

### 5. Real-time Updates

The dashboard automatically refreshes data every 5 seconds. You can also manually refresh using the "Refresh" button on each page.

---

## 🔌 API Integration

### Authentication Flow

```javascript
// 1. Login
POST /api/auth/login
{
  "email": "john.admin@intellisight.com",
  "password": "admin123"
}

// Response:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "User_ID": 1,
      "Name": "John Admin",
      "Email": "john.admin@intellisight.com",
      "Role": "ADMIN"
    }
  }
}

// 2. Subsequent requests include JWT token:
Authorization: Bearer <token>
```

### Real-time Polling

```javascript
// Dashboard auto-fetches every 5 seconds
useEffect(() => {
  const interval = setInterval(() => {
    fetchDashboardData();
  }, 5000);
  
  return () => clearInterval(interval);
}, []);
```

### Error Handling

```javascript
// API interceptor handles 401 errors automatically
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Auto-logout and redirect to login
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

---

## 📁 Project Structure

```
admin-dashboard/
├── public/
│   └── vite.svg
├── src/
│   ├── api/
│   │   └── api.js                 # Axios instance & API functions
│   ├── components/
│   │   ├── Layout.jsx             # Main layout wrapper
│   │   ├── ProtectedRoute.jsx    # Route guard for auth
│   │   └── Sidebar.jsx            # Sidebar navigation
│   ├── context/
│   │   └── AuthContext.jsx        # Authentication context
│   ├── pages/
│   │   ├── Dashboard.jsx          # Main dashboard
│   │   ├── Login.jsx              # Login page
│   │   ├── Logs.jsx               # Activity logs
│   │   ├── Settings.jsx           # Settings page
│   │   ├── Students.jsx           # Students list
│   │   ├── Teachers.jsx           # Teachers list
│   │   ├── ZoneDetail.jsx         # Zone detail view
│   │   └── Zones.jsx              # Zones list
│   ├── styles/
│   │   └── index.css              # Global styles & Tailwind
│   ├── App.jsx                    # Main App component
│   └── main.jsx                   # Entry point
├── .env.example                   # Environment variables template
├── index.html                     # HTML template
├── package.json                   # Dependencies
├── postcss.config.js              # PostCSS config
├── tailwind.config.js             # Tailwind config
├── vite.config.js                 # Vite config
└── README.md                      # This file
```

---

## 🧪 Testing

### Manual Testing

1. **Start Backend Server**
```bash
cd ..
npm run dev
```

2. **Start Dashboard**
```bash
cd admin-dashboard
npm run dev
```

3. **Test Login**
- Navigate to `http://localhost:3001`
- Login with admin credentials
- Verify redirect to dashboard

4. **Test Real-time Updates**
- Watch dashboard for auto-updates every 5 seconds
- Check browser console for API calls

5. **Test Navigation**
- Click through all sidebar links
- Verify each page loads correctly
- Test zone detail page navigation

### API Testing

```bash
# Test backend is running
curl http://localhost:3000/health

# Test login endpoint
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.admin@intellisight.com","password":"admin123"}'

# Test zones endpoint (with token)
curl http://localhost:3000/api/zones \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🚢 Deployment

### Build for Production

```bash
npm run build
```

This creates optimized files in `dist/` folder.

### Deploy to Vercel

```bash
npm install -g vercel
vercel
```

### Deploy to Netlify

```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Environment Variables for Production

Set these in your hosting provider:
```
VITE_API_BASE_URL=https://your-backend-url.com/api
VITE_POLLING_INTERVAL=5000
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

---

## 📝 License

This project is part of the IntelliSight FYP project.

---

## 👥 Authors

**IntelliSight Development Team**

- Dashboard Design & Implementation
- Real-time Zone Tracking Integration
- Face Recognition Backend Connection

---

## 🙏 Acknowledgments

- React team for the amazing framework
- Tailwind CSS for the utility-first CSS
- Vite for lightning-fast dev experience
- IntelliSight backend team for API support

---

## 📞 Support

For issues and questions:
1. Check [API Documentation](../README.md)
2. Review backend setup in parent directory
3. Ensure backend is running on port 3000
4. Check browser console for errors

---

<div align="center">

**Built with ❤️ for IntelliSight FYP Project**

[Dashboard](#) • [Backend](../README.md) • [Documentation](../README.md)

</div>
