import React from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import AuthScreen from './components/AuthScreen';
import ProcessingApp from './components/ProcessingApp';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  // Show loading while Clerk initializes
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show auth screen if user is not authenticated
  if (!isSignedIn) {
    return <AuthScreen />;
  }

  // Show processing app if user is authenticated
  return <ProcessingApp user={user} />;
}

export default App;