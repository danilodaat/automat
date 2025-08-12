import React, { useState } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { LogOut, Send, User, AlertCircle, CheckCircle } from 'lucide-react';
import { sendDataToBackend } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

const AuthenticatedApp: React.FC = () => {
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const [inputData, setInputData] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputData.trim()) return;

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const result = await sendDataToBackend(inputData, token);
      setResponse(result.message || 'Respuesta recibida del servidor');
    } catch (err: any) {
      const errorMessage = err.message || 'Error al comunicarse con el servidor';
      setError(errorMessage);
      
      // Auto logout if token is invalid
      if (err.message?.includes('token') || err.message?.includes('401')) {
        setTimeout(() => {
          signOut();
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Bienvenido, {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors duration-200 font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Interactuar con Backend
          </h2>
          
          {/* Input Form */}
          <form onSubmit={handleSubmit} className="mb-8">
            <div className="mb-4">
              <label htmlFor="data-input" className="block text-sm font-semibold text-gray-700 mb-2">
                Datos a enviar
              </label>
              <textarea
                id="data-input"
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-none"
                placeholder="Escribe los datos que quieres enviar al backend..."
                value={inputData}
                onChange={(e) => setInputData(e.target.value)}
                disabled={loading}
              />
            </div>
            
            <button
              type="submit"
              disabled={loading || !inputData.trim()}
              className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105 disabled:transform-none"
            >
              {loading ? (
                <LoadingSpinner />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Enviar</span>
                </>
              )}
            </button>
          </form>

          {/* Response Section */}
          <div className="space-y-4">
            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                  <p className="text-red-700">{error}</p>
                  {error.includes('token') && (
                    <p className="text-sm text-red-600 mt-2">
                      Cerrando sesión automáticamente...
                    </p>
                  )}
                </div>
              </div>
            )}

            {response && (
              <div className="flex items-start space-x-3 p-4 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-green-900 mb-1">Respuesta del servidor</h3>
                  <p className="text-green-800">{response}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Card */}
        <div className="mt-8 bg-blue-50 rounded-2xl p-6 border border-blue-100">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Información de conexión
          </h3>
          <p className="text-blue-800 mb-2">
            <strong>Backend URL:</strong> {import.meta.env.VITE_API_URL || 'No configurada'}
          </p>
          <p className="text-blue-700 text-sm">
            Todas las peticiones se envían con autenticación JWT automáticamente.
          </p>
        </div>
      </main>
    </div>
  );
};

export default AuthenticatedApp;