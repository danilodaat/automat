import React, { useState } from 'react';
import { SignIn, SignUp } from '@clerk/clerk-react';
import { Play, Shield, Zap } from 'lucide-react';

const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl mb-6 shadow-xl">
            <Play className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-3">
            MediaProcessor
          </h1>
          <p className="text-gray-600 text-lg mb-6">
            Procesa contenido multimedia en tiempo real
          </p>
          
          {/* Features */}
          <div className="grid grid-cols-1 gap-3 mb-8">
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-indigo-600" />
              </div>
              <span>Autenticación segura con Clerk</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-600" />
              </div>
              <span>Procesamiento en tiempo real</span>
            </div>
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                <Play className="w-4 h-4 text-indigo-600" />
              </div>
              <span>YouTube, TV y Radio</span>
            </div>
          </div>
        </div>

        {/* Auth Toggle */}
        <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
          <button
            onClick={() => setIsSignUp(false)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              !isSignUp 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => setIsSignUp(true)}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all duration-200 ${
              isSignUp 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Clerk Auth Component */}
        <div className="bg-white rounded-2xl shadow-2xl p-1 border border-gray-100">
          {isSignUp ? (
            <SignUp 
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-none bg-transparent",
                  headerTitle: "text-2xl font-bold text-gray-900",
                  headerSubtitle: "text-gray-600",
                  socialButtonsBlockButton: "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-colors duration-200 rounded-lg",
                  socialButtonsBlockButtonText: "font-medium",
                  formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 transition-all duration-200 rounded-lg",
                  footerActionLink: "text-indigo-600 hover:text-indigo-700 font-medium"
                }
              }}
            />
          ) : (
            <SignIn 
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none border-none bg-transparent",
                  headerTitle: "text-2xl font-bold text-gray-900",
                  headerSubtitle: "text-gray-600",
                  socialButtonsBlockButton: "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-colors duration-200 rounded-lg",
                  socialButtonsBlockButtonText: "font-medium",
                  formButtonPrimary: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-3 transition-all duration-200 rounded-lg",
                  footerActionLink: "text-indigo-600 hover:text-indigo-700 font-medium"
                }
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Plataforma segura para procesamiento multimedia
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;