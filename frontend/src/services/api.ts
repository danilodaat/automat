// Socket.IO connection utilities
export const getSocketUrl = (): string => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    throw new Error('Backend URL no está configurada. Verifica la variable VITE_API_URL en .env');
  }
  return apiUrl;
};

export interface ProcessingData {
  tipo_pauta: 'tv' | 'radio' | 'youtube';
  id_pauta?: string;
  youtube_url?: string;
}

export interface ProcessingResults {
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

export interface ProgressUpdate {
  progress: number;
  message: string;
}

export interface ProcessingError {
  error: string;
}