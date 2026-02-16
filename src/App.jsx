import React from 'react';
import { useFixtures } from './hooks/useFixtures';
import AdminLogin from './components/admin/AdminLogin';
import AdminPanel from './components/admin/AdminPanel';
import PublicView from './components/public/PublicView';

export default function App() {
  const state = useFixtures();

  if (state.view === 'admin') {
    if (!state.isAuthenticated) {
      return (
        <AdminLogin
          passwordInput={state.passwordInput}
          setPasswordInput={state.setPasswordInput}
          setIsAuthenticated={state.setIsAuthenticated}
        />
      );
    }
    return <AdminPanel {...state} />;
  }

  return <PublicView {...state} />;
}
