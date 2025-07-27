import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, TextField } from '@mui/material';
import { clearAllCache } from '../utils/clearAllCache';

export const DiagnosticPanel: React.FC = () => {
  const [socketInfo, setSocketInfo] = useState<any[]>([]);
  const [hasServiceWorker, setHasServiceWorker] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [showUserIdEdit, setShowUserIdEdit] = useState(false);
  const [newUserId, setNewUserId] = useState('');

  useEffect(() => {
    // Check for any global WebSocket instances
    const checkGlobalSockets = () => {
      const info: any[] = [];

      // Check window object for any WebSocket references
      if ((window as any).WebSocket) {
        info.push({ type: 'window.WebSocket exists', value: true });
      }

      // Check for any WebSocket manager
      if ((window as any).webSocketManager) {
        info.push({ type: 'WebSocket manager exists', value: true });
      }

      // Check localStorage for any old data
      const keys = Object.keys(localStorage);
      const socketKeys = keys.filter((k) => k.includes('socket') || k.includes('terminal'));
      info.push({ type: 'LocalStorage keys', keys: socketKeys });

      // Get current user ID
      const userId = localStorage.getItem('terminal-user-id') || 'Not set';
      setCurrentUserId(userId);

      // Check for service workers
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          setHasServiceWorker(registrations.length > 0);
          if (registrations.length > 0) {
            info.push({ type: 'Service Workers', count: registrations.length });
          }
        });
      }

      setSocketInfo(info);
    };

    checkGlobalSockets();
    const interval = setInterval(checkGlobalSockets, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleChangeUserId = () => {
    if (newUserId.trim()) {
      localStorage.setItem('terminal-user-id', newUserId.trim());
      window.location.reload();
    }
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 10,
        right: 10,
        background: 'rgba(0,0,0,0.9)',
        padding: 2,
        border: '1px solid green',
        maxWidth: 350,
        borderRadius: 1,
      }}
    >
      <Typography variant="h6" color="green" gutterBottom>
        🔍 Diagnostics
      </Typography>

      <Typography variant="body2" color="green" sx={{ fontSize: '0.8rem', mb: 1 }}>
        User ID: {currentUserId.substring(0, 8)}...
      </Typography>

      {currentUserId === '84334750-4d3e-4305-be52-4bc981256181' && (
        <Typography variant="body2" color="red" sx={{ fontSize: '0.8rem', mb: 1 }}>
          ⚠️ PROBLEMATIC USER ID DETECTED!
        </Typography>
      )}

      {hasServiceWorker && (
        <Typography variant="body2" color="orange" sx={{ mb: 1 }}>
          ⚠️ Service Workers detected!
        </Typography>
      )}

      {socketInfo.map((info, idx) => (
        <Typography key={idx} variant="body2" color="green" sx={{ fontSize: '0.8rem' }}>
          {info.type}: {JSON.stringify(info.value || info.count || info.keys)}
        </Typography>
      ))}

      {showUserIdEdit && (
        <Box sx={{ mt: 1 }}>
          <TextField
            size="small"
            fullWidth
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="Enter new user ID"
            sx={{ mb: 1 }}
          />
          <Button
            variant="outlined"
            color="primary"
            size="small"
            onClick={handleChangeUserId}
            fullWidth
          >
            Change User ID
          </Button>
        </Box>
      )}

      <Button
        variant="outlined"
        color="warning"
        onClick={() => setShowUserIdEdit(!showUserIdEdit)}
        size="small"
        fullWidth
        sx={{ mt: 1 }}
      >
        {showUserIdEdit ? 'Cancel' : 'Change User ID'}
      </Button>

      <Button
        variant="contained"
        color="error"
        onClick={clearAllCache}
        size="small"
        fullWidth
        sx={{ mt: 1 }}
      >
        🧹 CLEAR ALL & RELOAD
      </Button>

      <Typography variant="caption" color="grey" sx={{ display: 'block', mt: 1 }}>
        This will clear ALL browser storage and reload
      </Typography>
    </Box>
  );
};
