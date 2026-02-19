# Admin Notification System - Frontend Integration Guide

## Overview
The notification system provides in-app notifications for platform administrators, focusing on security-related events like password changes and account activities.

## API Endpoints
### Base URL
```
/api/v1/admin/notifications
```

### Authentication
All endpoints require:
- JWT Bearer token
- `PLATFORM_ADMIN` role
- Tenant context from JWT

---

## 1. Get Notifications List

**Endpoint:** `GET /api/v1/admin/notifications`

**Query Parameters:**
- `status` (optional): `UNREAD` | `READ`
- `limit` (optional): number (default: 50, max: 100)
- `offset` (optional): number (default: 0)

**Response:**
```typescript
{
  notifications: NotificationDto[],
  total: number,        // Total matching filter
  unreadCount: number,  // Total unread across all
  limit?: number,
  offset?: number
}
```

**Usage:**
```javascript
// Get first page of unread notifications
const response = await api.get('/admin/notifications', {
  params: { status: 'UNREAD', limit: 20, offset: 0 }
});

// Get all notifications with pagination
const allNotifications = await api.get('/admin/notifications', {
  params: { limit: 50, offset: 0 }
});
```

---

## 2. Get Unread Count (for Badge)

**Endpoint:** `GET /api/v1/admin/notifications/unread-count`

**Response:**
```typescript
{
  count: number
}
```

**Usage:**
```javascript
// Update notification badge
const { count } = await api.get('/admin/notifications/unread-count');
setBadgeCount(count);
```

---

## 3. Get Summary Statistics

**Endpoint:** `GET /api/v1/admin/notifications/summary`

**Response:**
```typescript
{
  total: number,           // Total notifications
  unread: number,          // Unread count
  bySeverity: {            // Unread count by severity
    "HIGH": number,
    "CRITICAL": number
  },
  recent: NotificationDto[] // Last 5 unread notifications
}
```

**Usage:**
```javascript
// Dashboard overview
const summary = await api.get('/admin/notifications/summary');
// Use for quick stats display
```

---

## 4. Mark Notification as Read

**Endpoint:** `PATCH /api/v1/admin/notifications/:id/read`

**Response:**
```typescript
{
  success: boolean,
  notification?: NotificationDto
}
```

**Usage:**
```javascript
// Mark single notification as read
const result = await api.patch(`/admin/notifications/${notificationId}/read`);
if (result.success) {
  // Update UI
  updateNotificationStatus(notificationId, 'READ');
}
```

---

## 5. Mark All Notifications as Read

**Endpoint:** `PATCH /api/v1/admin/notifications/mark-all-read`

**Response:**
```typescript
{
  success: boolean,
  markedCount: number
}
```

**Usage:**
```javascript
// Mark all as read (bulk action)
const result = await api.patch('/admin/notifications/mark-all-read');
if (result.success) {
  // Refresh UI and reset badge
  refreshNotifications();
  setBadgeCount(0);
}
```

---

## Data Types

### NotificationDto
```typescript
interface NotificationDto {
  id: string;
  eventType: NotificationEventType;
  severity: NotificationSeverity;
  title: string;
  message: string;
  metadata?: any;        // Additional context data
  status: 'UNREAD' | 'READ';
  readAt?: Date | null;
  createdAt: Date;
}
```

### Enums
```typescript
type NotificationEventType =
  | 'SECURITY_PASSWORD_RESET_REQUESTED'
  | 'SECURITY_PASSWORD_RESET_SUCCESS'
  | 'SECURITY_PASSWORD_CHANGED'
  | 'SECURITY_SUSPICIOUS_RESET_ACTIVITY'
  | 'SYSTEM_ACCOUNT_LOCKED';

type NotificationSeverity = 'INFO' | 'HIGH' | 'CRITICAL';
```

---

## Frontend Integration Patterns

### 1. Notification List Component
```javascript
const NotificationList = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = async (status = null, page = 0) => {
    try {
      const response = await api.get('/admin/notifications', {
        params: {
          status,
          limit: 20,
          offset: page * 20
        }
      });
      setNotifications(response.notifications);
      setTotal(response.total);
      setUnreadCount(response.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <div>
      <div className="notification-header">
        <h3>Notifications ({unreadCount} unread)</h3>
        <button onClick={() => loadNotifications('UNREAD')}>
          Show Unread Only
        </button>
      </div>
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onMarkRead={() => markAsRead(notification.id)}
        />
      ))}
    </div>
  );
};
```

### 2. Real-time Updates (Phase 2 - IMPLEMENTED ✅)

**WebSocket Endpoint:** `ws://localhost:3001/admin`

**Authentication:** Send JWT token in connection auth:
```javascript
const socket = io('/admin', {
  auth: { token: 'your-jwt-token' },
  // or via query: query: { token: 'your-jwt-token' }
});
```

**Events:**
- `notification`: New notification received
- `connect`: Connection established
- `disconnect`: Connection lost

**Real-time Integration:**
```javascript
import io from 'socket.io-client';

const NotificationSocket = () => {
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const newSocket = io('/admin', {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to notification socket');
    });

    newSocket.on('notification', (notification) => {
      console.log('New notification:', notification);
      setNotifications(prev => [notification, ...prev]);
      // Update badge count
      setUnreadCount(prev => prev + 1);
      // Show toast notification
      showToast(notification.title, notification.message);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from notification socket');
    });

    setSocket(newSocket);

    return () => newSocket.disconnect();
  }, []);

  return socket;
};
```

**Features:**
- ✅ Instant notification delivery via Socket.IO
- ✅ User-specific rooms (only receive your notifications)
- ✅ Automatic reconnection
- ✅ JWT authentication
- 🔄 Push notifications (browser notifications) - next step

### 3. Badge Component
```javascript
const NotificationBadge = () => {
  const [count, setCount] = useState(0);

  const loadUnreadCount = async () => {
    try {
      const { count } = await api.get('/admin/notifications/unread-count');
      setCount(count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  };

  useEffect(() => {
    loadUnreadCount();
    // Poll every 30 seconds or use real-time updates
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  return count > 0 ? <span className="badge">{count}</span> : null;
};
```

---

## Step-by-Step Frontend Integration Guide

### 📋 **Phase 1: Basic Integration (REST APIs)**

#### **1. Install Dependencies**
```bash
npm install axios  # or your preferred HTTP client
```

#### **2. Create API Service**
```javascript
// services/notificationService.js
const API_BASE = '/api/v1/admin/notifications';

export const notificationAPI = {
  // Get notifications with pagination
  getNotifications: (params = {}) =>
    api.get(`${API_BASE}`, { params }),

  // Get unread count for badge
  getUnreadCount: () =>
    api.get(`${API_BASE}/unread-count`),

  // Get summary stats
  getSummary: () =>
    api.get(`${API_BASE}/summary`),

  // Mark single notification as read
  markAsRead: (id) =>
    api.patch(`${API_BASE}/${id}/read`),

  // Mark all as read
  markAllAsRead: () =>
    api.patch(`${API_BASE}/mark-all-read`)
};
```

#### **3. Create Notification Context/Hook**
```javascript
// hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/notificationService';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async (params = {}) => {
    setLoading(true);
    try {
      const response = await notificationAPI.getNotifications(params);
      setNotifications(response.data.notifications);
      setUnreadCount(response.data.unreadCount);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUnreadCount = useCallback(async () => {
    try {
      const { data } = await notificationAPI.getUnreadCount();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, []);

  const markAsRead = useCallback(async (id) => {
    try {
      await notificationAPI.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? {...n, status: 'READ'} : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const { data } = await notificationAPI.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({...n, status: 'READ'}))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }, []);

  useEffect(() => {
    loadNotifications({ limit: 20 });
    loadUnreadCount();
  }, [loadNotifications, loadUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    loadUnreadCount,
    markAsRead,
    markAllAsRead
  };
};
```

### 📡 **Phase 2: Real-time Integration (Socket.IO)**

#### **4. Install Socket.IO Client**
```bash
npm install socket.io-client
```

#### **5. Create Socket Hook**
```javascript
// hooks/useNotificationSocket.js
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useNotificationSocket = (token, onNotification) => {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!token) return;

    const socket = io('/admin', {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
    });

    socket.on('connect', () => {
      console.log('🔔 Connected to notification socket');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Disconnected from notification socket');
      setIsConnected(false);
    });

    socket.on('notification', (notification) => {
      console.log('🔔 New notification:', notification);
      onNotification?.(notification);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, onNotification]);

  return { isConnected };
};
```

#### **6. Update Notification Component**
```javascript
// components/NotificationPanel.js
import { useNotifications } from '../hooks/useNotifications';
import { useNotificationSocket } from '../hooks/useNotificationSocket';

const NotificationPanel = () => {
  const {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead
  } = useNotifications();

  // Handle real-time notifications
  const handleNewNotification = useCallback((notification) => {
    // Add to list
    setNotifications(prev => [notification, ...prev]);

    // Update badge
    setUnreadCount(prev => prev + 1);

    // Show toast
    toast.success(notification.title, {
      description: notification.message,
      duration: 5000,
    });
  }, []);

  const { isConnected } = useNotificationSocket(
    localStorage.getItem('authToken'),
    handleNewNotification
  );

  return (
    <div className="notification-panel">
      <div className="notification-header">
        <h3>Notifications ({unreadCount} unread)</h3>
        <div className="connection-status">
          {isConnected ? '🟢 Live' : '🔴 Offline'}
        </div>
        <button onClick={markAllAsRead}>Mark All Read</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <div className="notification-list">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={() => markAsRead(notification.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
```

#### **7. Create Notification Item Component**
```javascript
// components/NotificationItem.js
const NotificationItem = ({ notification, onMarkRead }) => {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 font-bold';
      case 'HIGH': return 'text-red-500';
      case 'INFO': return 'text-blue-500';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`notification-item ${notification.status === 'UNREAD' ? 'unread' : ''}`}>
      <div className="notification-content">
        <h4 className={getSeverityColor(notification.severity)}>
          {notification.title}
        </h4>
        <p>{notification.message}</p>
        <small>{new Date(notification.createdAt).toLocaleString()}</small>
      </div>
      {notification.status === 'UNREAD' && (
        <button onClick={onMarkRead}>Mark Read</button>
      )}
    </div>
  );
};
```

#### **8. Add Notification Badge**
```javascript
// components/NotificationBadge.js
const NotificationBadge = ({ count }) => {
  if (count === 0) return null;

  return (
    <span className="notification-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};
```

### 🧪 **Testing Integration**

#### **9. Test Basic APIs**
```javascript
// Test in browser console or component
const testNotifications = async () => {
  try {
    const response = await notificationAPI.getNotifications({ limit: 5 });
    console.log('Notifications:', response.data);
  } catch (error) {
    console.error('API test failed:', error);
  }
};
```

#### **10. Test Real-time Connection**
```javascript
// Check browser Network tab for WebSocket connection
// Should see: ws://localhost:3001/admin
```

#### **11. Trigger Test Notifications**
1. Login as platform admin
2. Change password → Check for `SECURITY_PASSWORD_CHANGED`
3. Request password reset → Check for `SECURITY_PASSWORD_RESET_REQUESTED`

### 📋 **Integration Checklist**
- [ ] Install dependencies (axios, socket.io-client)
- [ ] Create API service functions
- [ ] Implement notification hook
- [ ] Create notification components
- [ ] Add Socket.IO real-time updates
- [ ] Test API endpoints
- [ ] Test real-time notifications
- [ ] Add error handling
- [ ] Style components
- [ ] Add accessibility features

---

## Error Handling

### Common HTTP Status Codes
- `200`: Success
- `401`: Unauthorized (invalid/missing JWT)
- `403`: Forbidden (not a platform admin)
- `404`: Notification not found
- `500`: Server error

### Error Response Format
```typescript
{
  statusCode: number,
  message: string | string[],
  error: string
}
```

---

## Best Practices

### 1. Polling Strategy
- Poll unread count every 30-60 seconds
- Poll full list on user interaction
- Use real-time updates when available

### 2. UI Patterns
- Show severity with color coding (HIGH=red, CRITICAL=red+bold)
- Display relative timestamps ("2 hours ago")
- Provide bulk actions for power users
- Auto-refresh after mark-as-read actions

### 3. Performance
- Paginate with reasonable limits (20-50 items)
- Cache notification data locally
- Debounce rapid mark-as-read actions

### 4. Accessibility
- Announce new notifications to screen readers
- Provide keyboard navigation
- Use semantic HTML for notification items

---

## Testing the Integration

### Sample API Calls
```bash
# Get notifications
curl -H "Authorization: Bearer YOUR_JWT" \
     "http://localhost:3001/api/v1/admin/notifications?limit=10"

# Get unread count
curl -H "Authorization: Bearer YOUR_JWT" \
     "http://localhost:3001/api/v1/admin/notifications/unread-count"

# Mark as read
curl -X PATCH -H "Authorization: Bearer YOUR_JWT" \
     "http://localhost:3001/api/v1/admin/notifications/123/read"
```

### Triggering Test Notifications
1. Login as platform admin
2. Change password via profile → triggers `SECURITY_PASSWORD_CHANGED`
3. Request password reset → triggers `SECURITY_PASSWORD_RESET_REQUESTED`
4. Complete password reset → triggers `SECURITY_PASSWORD_RESET_SUCCESS`

---

## Future Enhancements

### Phase 2: Real-time Updates
- Socket.IO integration for instant notifications
- Push notifications for critical alerts

### Phase 3: Advanced Features
- Notification preferences (disable types)
- Email notifications toggle
- Notification categories/groups
- Advanced filtering and search

The current API is stable and ready for production integration! 🚀