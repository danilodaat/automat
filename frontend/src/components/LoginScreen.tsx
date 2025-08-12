import React from 'react';
import { SignIn } from '@clerk/clerk-react';
import { Shield } from 'lucide-react';

const LoginScreen: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Bienvenido
          </h1>
          <p className="text-gray-600">
            Inicia sesión para acceder a la aplicación
          </p>
        </div>

        {/* Clerk Sign In Component */}
        <div className="bg-white rounded-2xl shadow-xl p-1 border border-gray-100">
          <SignIn 
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-none bg-transparent",
                headerTitle: "text-2xl font-semibold text-gray-900",
                headerSubtitle: "text-gray-600",
                socialButtonsBlockButton: "bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium transition-colors duration-200",
                socialButtonsBlockButtonText: "font-medium",
                formButtonPrimary: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 transition-colors duration-200",
                footerActionLink: "text-blue-600 hover:text-blue-700 font-medium"
              }
            }}
          />
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Aplicación segura con autenticación Clerk
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginScreen;