import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';


const PrivateRoute = () => {
  const { authLoaded } = useAuth();

  if (!authLoaded) return null;

    return <Outlet />;


  // const isAuthenticated = !!localStorage.getItem('token');
  // return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

export default PrivateRoute;
