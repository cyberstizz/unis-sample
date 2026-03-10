import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

const AdminRoute = ({ requiredLevel = 'moderator' }) => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');

  if (!token || !user) return <Navigate to="/login" />;

  // Check admin role from user profile
  if (!user.adminRole) return <Navigate to="/" />;

  // Level hierarchy: super_admin > admin > moderator
  const levels = ['moderator', 'admin', 'super_admin'];
  const userLevel = levels.indexOf(user.adminRole);
  const requiredLevelIndex = levels.indexOf(requiredLevel);

  if (userLevel < requiredLevelIndex) return <Navigate to="/admin" />;

  return <Outlet />;
};

export default AdminRoute;