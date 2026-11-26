
import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import LandingPage from './components/LandingPage';
// Dashboard pulls in three.js, maps, PDF and AI SDKs: load it only after sign-in.
const Dashboard = React.lazy(() => import('./components/Dashboard'));

const AppLoading: React.FC = () => (
  <div className="flex min-h-screen items-center justify-center bg-paper">
    <p className="label-mono animate-pulse">Loading SymptomSage…</p>
  </div>
);

const App: React.FC = () => {
  return (
    <Suspense fallback={<AppLoading />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/app"
        element={
          <>
            <SignedIn>
              <Dashboard />
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      />
      <Route
        path="/app/:view"
        element={
          <>
            <SignedIn>
              <Dashboard />
            </SignedIn>
            <SignedOut>
              <Navigate to="/" replace />
            </SignedOut>
          </>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default App;
