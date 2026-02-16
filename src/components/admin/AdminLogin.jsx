import React from 'react';
import { ADMIN_PASSWORD } from '../../config';

export default function AdminLogin({ passwordInput, setPasswordInput, setIsAuthenticated }) {
  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
    } else {
      alert('Incorrect password');
      setPasswordInput('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-24 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Access</h1>
        <p className="text-gray-600 mb-6">Please enter the password to access the admin panel.</p>
        <input
          type="password"
          value={passwordInput}
          onChange={(e) => setPasswordInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleLogin();
          }}
          placeholder="Enter password"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
        <button
          onClick={handleLogin}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Login
        </button>
      </div>
    </div>
  );
}
