import { createContext, useContext, useMemo } from 'react';

// ==========================================
// Auth context
// ==========================================
// Accounts aren't wired up yet: v2 will use Supabase.
// Until then everyone is a guest. Components already read auth through
// useAuth(), so adding Supabase later only changes this file.

const AuthContext = createContext(null);

const notAvailableYet = async () => {
  throw new Error('Accounts are not available yet.');
};

export const AuthProvider = ({ children }) => {
  const value = useMemo(() => ({
    user: null,
    userProfile: null,
    loading: false,
    isAuthenticated: false,
    login: notAvailableYet,
    logout: notAvailableYet,
  }), []);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;
