import React, { useState } from 'react';
import { 
  CheckCircle, 
  RotateCcw, 
  FileText, 
  Users, 
  Tag, 
  Search, 
  ChevronDown, 
  ChevronUp,
  Copy,
  Download
} from 'lucide-react';

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

interface ResultsDisplayProps {
  results: ProcessingResults;
  onReset: () => void;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, onReset }) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    transcripcion: false,
    entidades: true,
    temas: true,
    coincidencias: true
  });

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadResults = () => {
    const data = {
      titular: results.titular,
      resumen: results.resumen,
      entidades: results.entidades,
      temas: results.temas,
      coincidencias: results.coincidencias,
      transcripcion: results.transcripcion,
      fecha_procesamiento: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resultados_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                Procesamiento Completado
              </h2>
              <p className="text-gray-600">
                El contenido ha sido procesado exitosamente
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={downloadResults}
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 rounded-xl transition-colors duration-200 font-medium"
            >
              <Download className="w-4 h-4" />
              <span>Descargar</span>
            </button>
            <button
              onClick={onReset}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Procesar otra entrada</span>
            </button>
          </div>
        </div>
      </div>

      {/* Titular y Resumen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              <h3 className="text-xl font-bold text-gray-900">Titular</h3>
            </div>
            <button
              onClick={() => copyToClipboard(results.titular)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <p className="text-gray-800 leading-relaxed font-medium">
            {results.titular}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-5 h-5 text-purple-600" />
              <h3 className="text-xl font-bold text-gray-900">Resumen</h3>
            </div>
            <button
              onClick={() => copyToClipboard(results.resumen)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <p className="text-gray-700 leading-relaxed">
            {results.resumen}
          </p>
        </div>
      </div>

      {/* Entidades */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div 
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => toggleSection('entidades')}
        >
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="text-xl font-bold text-gray-900">Entidades Identificadas</h3>
            <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2 py-1 rounded-full">
              {Object.keys(results.entidades).length} categorías
            </span>
          </div>
          {expandedSections.entidades ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
        {expandedSections.entidades && (
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(results.entidades).map(([categoria, entidades]) => (
                <div key={categoria} className="bg-gray-50 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 capitalize">
                    {categoria}
                  </h4>
                  <div className="space-y-1">
                    {entidades.map((entidad, index) => (
                      <span
                        key={index}
                        className="inline-block bg-white text-gray-700 text-sm px-3 py-1 rounded-lg mr-2 mb-1 border"
                      >
                        {entidad}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Temas */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div 
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => toggleSection('temas')}
        >
          <div className="flex items-center space-x-2">
            <Tag className="w-5 h-5 text-green-600" />
            <h3 className="text-xl font-bold text-gray-900">Temas Principales</h3>
            <span className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded-full">
              {results.temas.length} temas
            </span>
          </div>
          {expandedSections.temas ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
        {expandedSections.temas && (
          <div className="px-6 pb-6">
            <div className="flex flex-wrap gap-2">
              {results.temas.map((tema, index) => (
                <span
                  key={index}
                  className="bg-green-100 text-green-800 text-sm font-medium px-4 py-2 rounded-full border border-green-200"
                >
                  {tema}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Coincidencias */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div 
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => toggleSection('coincidencias')}
        >
          <div className="flex items-center space-x-2">
            <Search className="w-5 h-5 text-orange-600" />
            <h3 className="text-xl font-bold text-gray-900">Coincidencias Encontradas</h3>
            <span className="bg-orange-100 text-orange-800 text-sm font-medium px-2 py-1 rounded-full">
              {results.coincidencias.length} coincidencias
            </span>
          </div>
          {expandedSections.coincidencias ? (
            <ChevronUp className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          )}
        </div>
        {expandedSections.coincidencias && (
          <div className="px-6 pb-6">
            {results.coincidencias.length > 0 ? (
              <div className="space-y-3">
                {results.coincidencias.map((coincidencia, index) => (
                  <div key={index} className="bg-orange-50 rounded-xl p-4 border border-orange-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-orange-900">
                          {coincidencia.cliente}
                        </span>
                        <span className="mx-2 text-orange-600">•</span>
                        <span className="text-orange-800">
                          "{coincidencia.palabra_clave}"
                        </span>
                      </div>
                      <span className="bg-orange-200 text-orange-800 text-xs font-medium px-2 py-1 rounded-full">
                        {coincidencia.tipo}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No se encontraron coincidencias
              </p>
            )}
          </div>
        )}
      </div>

      {/* Transcripción */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div 
          className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
          onClick={() => toggleSection('transcripcion')}
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h3 className="text-xl font-bold text-gray-900">Transcripción Completa</h3>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                copyToClipboard(results.transcripcion);
              }}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors duration-200"
            >
              <Copy className="w-4 h-4 text-gray-500" />
            </button>
            {expandedSections.transcripcion ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </div>
        </div>
        {expandedSections.transcripcion && (
          <div className="px-6 pb-6">
            <div className="bg-gray-50 rounded-xl p-6 max-h-96 overflow-y-auto">
              <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                {results.transcripcion}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;