import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = () => {
  const { authLoaded } = useAuth();

  // Wait until auth check completes (prevents flash of wrong state)
  if (!authLoaded) return null;

  // Always render child routes — guests can browse freely.
  // Individual features (voting, earnings, etc.) gate themselves
  // via useAuthGate() and the AuthGateSheet component.
  return <Outlet />;
};

export default PrivateRoute;