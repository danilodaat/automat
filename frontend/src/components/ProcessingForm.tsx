import React, { useState } from 'react';
import { Play, Youtube, Tv, Radio } from 'lucide-react';

interface ProcessingData {
  tipo_pauta: 'tv' | 'radio' | 'youtube';
  id_pauta?: string;
  youtube_url?: string;
}

interface ProcessingFormProps {
  onSubmit: (data: ProcessingData) => void;
}

const ProcessingForm: React.FC<ProcessingFormProps> = ({ onSubmit }) => {
  const [tipoPauta, setTipoPauta] = useState<'tv' | 'radio' | 'youtube'>('youtube');
  const [idPauta, setIdPauta] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: ProcessingData = {
      tipo_pauta: tipoPauta,
    };

    if (tipoPauta === 'youtube') {
      if (!youtubeUrl.trim()) {
        alert('Por favor ingresa una URL de YouTube válida');
        return;
      }
      data.youtube_url = youtubeUrl.trim();
    } else {
      if (!idPauta.trim()) {
        alert('Por favor ingresa un ID de pauta válido');
        return;
      }
      data.id_pauta = idPauta.trim();
    }

    onSubmit(data);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'youtube':
        return <Youtube className="w-5 h-5" />;
      case 'tv':
        return <Tv className="w-5 h-5" />;
      case 'radio':
        return <Radio className="w-5 h-5" />;
      default:
        return <Play className="w-5 h-5" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl mb-4">
          <Play className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Procesar Contenido Multimedia
        </h2>
        <p className="text-gray-600">
          Selecciona el tipo de contenido y proporciona la información necesaria
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Tipo de Pauta */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Tipo de contenido
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { value: 'youtube', label: 'YouTube', icon: 'youtube', color: 'red' },
              { value: 'tv', label: 'TV', icon: 'tv', color: 'blue' },
              { value: 'radio', label: 'Radio', icon: 'radio', color: 'green' }
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTipoPauta(option.value as 'tv' | 'radio' | 'youtube')}
                className={`flex items-center space-x-3 p-4 rounded-xl border-2 transition-all duration-200 ${
                  tipoPauta === option.value
                    ? `border-${option.color}-500 bg-${option.color}-50 text-${option.color}-700`
                    : 'border-gray-200 hover:border-gray-300 text-gray-700'
                }`}
              >
                {getIcon(option.icon)}
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Campos condicionales */}
        {tipoPauta === 'youtube' ? (
          <div>
            <label htmlFor="youtube-url" className="block text-sm font-semibold text-gray-700 mb-2">
              URL de YouTube
            </label>
            <div className="relative">
              <Youtube className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-red-500" />
              <input
                id="youtube-url"
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                required
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Ingresa la URL completa del video de YouTube que deseas procesar
            </p>
          </div>
        ) : (
          <div>
            <label htmlFor="id-pauta" className="block text-sm font-semibold text-gray-700 mb-2">
              ID de Pauta {tipoPauta === 'tv' ? 'de TV' : 'de Radio'}
            </label>
            <div className="relative">
              {tipoPauta === 'tv' ? (
                <Tv className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-500" />
              ) : (
                <Radio className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-500" />
              )}
              <input
                id="id-pauta"
                type="text"
                value={idPauta}
                onChange={(e) => setIdPauta(e.target.value)}
                placeholder={`Ingresa el ID de la pauta de ${tipoPauta}`}
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-900 placeholder-gray-500"
                required
              />
            </div>
            <p className="mt-2 text-sm text-gray-600">
              Identificador único de la pauta {tipoPauta === 'tv' ? 'televisiva' : 'radial'} a procesar
            </p>
          </div>
        )}

        {/* Botón de envío */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full flex items-center justify-center space-x-3 px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            <Play className="w-5 h-5" />
            <span>Iniciar Procesamiento</span>
          </button>
        </div>
      </form>

      {/* Info Cards */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-red-50 rounded-xl p-4 border border-red-100">
          <div className="flex items-center space-x-2 mb-2">
            <Youtube className="w-4 h-4 text-red-600" />
            <span className="font-semibold text-red-900 text-sm">YouTube</span>
          </div>
          <p className="text-xs text-red-700">
            Descarga audio, transcribe y analiza contenido de videos
          </p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-2">
            <Tv className="w-4 h-4 text-blue-600" />
            <span className="font-semibold text-blue-900 text-sm">TV</span>
          </div>
          <p className="text-xs text-blue-700">
            Procesa pautas televisivas usando ID de referencia
          </p>
        </div>
        <div className="bg-green-50 rounded-xl p-4 border border-green-100">
          <div className="flex items-center space-x-2 mb-2">
            <Radio className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-green-900 text-sm">Radio</span>
          </div>
          <p className="text-xs text-green-700">
            Analiza contenido radial mediante ID de pauta
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingForm;