import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { LogOut, Play, Radio, Tv, Youtube, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import LoadingSpinner from './LoadingSpinner';
import ProcessingForm from './ProcessingForm';
import ProgressBar from './ProgressBar';
import ResultsDisplay from './ResultsDisplay';

interface User {
  firstName?: string;
  emailAddresses: Array<{ emailAddress: string }>;
}

interface ProcessingAppProps {
  user: User | null;
}

interface ProcessingData {
  tipo_pauta: 'tv' | 'radio' | 'youtube';
  id_pauta?: string;
  youtube_url?: string;
}

interface ProcessingResults {
  titular: string;
  resumen: string;
  entidades: Record<string, string[]>;
  temas: string[];
  coincidencias: Array<{
    cliente: string;
    palabra_clave: string;
    tipo: string;
  }>;
  transcripcion: string;
}

const ProcessingApp: React.FC<ProcessingAppProps> = ({ user }) => {
  const { signOut, getToken } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentProcessing, setCurrentProcessing] = useState<ProcessingData | null>(null);
  const [results, setResults] = useState<ProcessingResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const getProcessingTitle = (data: ProcessingData) => {
    switch (data.tipo_pauta) {
      case 'tv':
        return `Procesando Pauta de TV ${data.id_pauta}`;
      case 'radio':
        return `Procesando Pauta de Radio ${data.id_pauta}`;
      case 'youtube':
        return 'Procesando Video de YouTube';
      default:
        return 'Procesando...';
    }
  };

  const initializeSocket = async () => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('No se pudo obtener el token de autenticación');
      }

      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error('URL del backend no configurada');
      }

      const newSocket = io(apiUrl, {
        auth: {
          token: token
        },
        extraHeaders: {
          'Authorization': `Bearer ${token}`
        }
      });

      newSocket.on('connect', () => {
        console.log('Conectado al servidor');
      });

      newSocket.on('progress', (data: { progress: number; message: string }) => {
        setProgress(data.progress);
        setProgressMessage(data.message);
      });

      newSocket.on('audio_ready', () => {
        setProgressMessage('Audio descargado, iniciando transcripción...');
      });

      newSocket.on('processing_done', (data: ProcessingResults) => {
        setIsProcessing(false);
        setResults(data);
        setProgress(100);
        setProgressMessage('Procesamiento completado');
      });

      newSocket.on('processing_error', (data: { error: string }) => {
        setIsProcessing(false);
        setError(data.error);
        setProgress(0);
        setProgressMessage('');
      });

      newSocket.on('disconnect', () => {
        console.log('Desconectado del servidor');
      });

      newSocket.on('connect_error', (err) => {
        console.error('Error de conexión:', err);
        setError('Error de conexión con el servidor');
      });

      setSocket(newSocket);
      socketRef.current = newSocket;
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    initializeSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const handleStartProcessing = (data: ProcessingData) => {
    if (!socket) {
      setError('No hay conexión con el servidor');
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage('Iniciando procesamiento...');
    setCurrentProcessing(data);
    setResults(null);
    setError(null);

    socket.emit('start_processing', data);
  };

  const handleReset = () => {
    setIsProcessing(false);
    setProgress(0);
    setProgressMessage('');
    setCurrentProcessing(null);
    setResults(null);
    setError(null);
  };

  const handleLogout = () => {
    if (socket) {
      socket.disconnect();
    }
    signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Play className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  MediaProcessor
                </h1>
                <p className="text-sm text-gray-600">
                  Bienvenido, {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors duration-200 font-medium"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Processing Status */}
        {isProcessing && currentProcessing && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl mb-4">
                  {currentProcessing.tipo_pauta === 'youtube' && <Youtube className="w-8 h-8 text-white" />}
                  {currentProcessing.tipo_pauta === 'tv' && <Tv className="w-8 h-8 text-white" />}
                  {currentProcessing.tipo_pauta === 'radio' && <Radio className="w-8 h-8 text-white" />}
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  {getProcessingTitle(currentProcessing)}
                </h2>
                <p className="text-gray-600">{progressMessage}</p>
              </div>
              <ProgressBar progress={progress} />
            </div>
          </div>
        )}

        {/* Results */}
        {results && !isProcessing && (
          <div className="mb-8">
            <ResultsDisplay results={results} onReset={handleReset} />
          </div>
        )}

        {/* Error */}
        {error && !isProcessing && (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="flex items-start space-x-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-red-900 mb-2">Error en el procesamiento</h3>
                  <p className="text-red-700 mb-6">{error}</p>
                  <button
                    onClick={handleReset}
                    className="flex items-center space-x-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Procesar otra entrada</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Form */}
        {!isProcessing && !results && !error && (
          <ProcessingForm onSubmit={handleStartProcessing} />
        )}

        {/* Connection Status */}
        <div className="mt-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${socket?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="font-semibold text-gray-900">
                  Estado de conexión: {socket?.connected ? 'Conectado' : 'Desconectado'}
                </h3>
                <p className="text-sm text-gray-600">
                  Backend: {import.meta.env.VITE_API_URL || 'No configurado'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProcessingApp;