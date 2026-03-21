import React from 'react';
import { useFixtures } from './hooks/useFixtures';
import AdminLogin from './components/admin/AdminLogin';
import AdminPanel from './components/admin/AdminPanel';
import PublicView from './components/public/PublicView';
import ClubPacksView from './components/public/ClubPacksView';

export default function App() {
  const state = useFixtures();
  const urlParams = new URLSearchParams(window.location.search);

  if (urlParams.get('view') === 'clubs') {
    return (
      <ClubPacksView
        fixtures={state.fixtures}
        teams={state.teams}
        zones={state.zones}
        generatedAt={state.generatedAt}
        lunchEnabled={state.lunchEnabled}
        lunchStart={state.lunchStart}
        lunchEnd={state.lunchEnd}
      />
    );
  }

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
