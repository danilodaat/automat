# app.py
"""
Reescritura completa del backend usando tu lógica original.
- Socket.IO (eventlet)
- CORS para localhost
- Endpoint /start para invocar el procesamiento desde frontend (POST)
- Soporta auth con Clerk si CLERK_SECRET_KEY está definida (opcional)
- Todas las claves via ENV
"""

import os
import sys
import time
import json
import logging
import tempfile
import re
import math
import shutil

from datetime import datetime, timedelta
from urllib.request import urlretrieve

# import eventlet
# eventlet.monkey_patch()

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit, disconnect
import requests
import mysql.connector
import pytz

# Multimedia / audio libs (asegúrate de tenerlas instaladas)
from moviepy.editor import VideoFileClip
from yt_dlp import YoutubeDL, utils as ytdlp_utils
import openpyxl

# OpenAI client
try:
    from openai import OpenAI
except Exception:
    OpenAI = None

# Optional: Clerk server SDK (if installed)
try:
    from clerk_backend_sdk import Clerk
except Exception:
    Clerk = None

# Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s', handlers=[logging.StreamHandler(sys.stdout)])
logger = logging.getLogger(__name__)

# -------------------------
# Config desde environment
# ------------------------

from dotenv import load_dotenv
import os

load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")
MYSQL_HOST = os.getenv("MYSQL_HOST", "localhost")
MYSQL_USER = os.getenv("MYSQL_USER", "user")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "notiexpress_dev")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
API_HOST = os.getenv("API_HOST", "http://localhost:5000")

if OPENAI_API_KEY and OpenAI is not None:
    client = OpenAI(api_key=OPENAI_API_KEY)
else:
    client = None
    logger.warning("OpenAI client no inicializado. Define OPENAI_API_KEY y asegúrate de tener openai>=... instalado si usarás GPT features.")

if CLERK_SECRET_KEY and Clerk is not None:
    clerk = Clerk(api_key=CLERK_SECRET_KEY)
else:
    clerk = None
    if CLERK_SECRET_KEY:
        logger.warning("CLERK_SECRET_KEY está definida pero no se encontró el paquete 'clerk'. La verificación de token fallará si no instalas clerk-sdk.")
    else:
        logger.info("CLERK no configurado. El servidor permitirá conexiones sin verificar (útil para pruebas locales).")

# Directorio de descargas temporales
DOWNLOAD_FOLDER = os.path.join(os.getcwd(), "downloads")
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# -------------------------
# Flask + SocketIO
# -------------------------
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app, 
     origins=["http://localhost:5173", "http://127.0.0.1:5173"],
     supports_credentials=True,
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"])
socketio = SocketIO(app, 
                   cors_allowed_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   async_mode='threading')
# -------------------------
# Helpers: DB, URLs, descargas, ffmpeg
# -------------------------
def connect_to_db():
    try:
        return mysql.connector.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE
        )
    except mysql.connector.Error as e:
        logger.error(f"DB connection error: {e}")
        return None

def fetch_record_by_id_pauta_tv(cursor, id_pauta_tv):
    sql = "SELECT p.* FROM pautas_tv p WHERE p.id_pauta_tv = %s;"
    cursor.execute(sql, (id_pauta_tv,))
    return cursor.fetchone()

def fetch_record_by_id_pauta_radio(cursor, id_pauta_radio):
    sql = "SELECT p.* FROM pautas_radio p WHERE p.id_pauta_radio = %s;"
    cursor.execute(sql, (id_pauta_radio,))
    return cursor.fetchone()

def build_url_tv(record):
    id_pauta_tv = record[0]
    utc_date = record[-1]
    peru_timezone = pytz.timezone("America/Lima")
    local_date = utc_date.replace(tzinfo=pytz.utc).astimezone(peru_timezone)
    year = local_date.strftime("%Y")
    month = local_date.strftime("%m")
    day = local_date.strftime("%d")
    return f"https://servicios.noticiasperu.pe/medios/tv/mp4_11/{year}/{month}/{day}/{id_pauta_tv}.mp4"

def build_url_radio(record):
    id_pauta_radio = record[0]
    utc_date = record[-1]
    peru_timezone = pytz.timezone("America/Lima")
    local_date = utc_date.replace(tzinfo=pytz.utc).astimezone(peru_timezone)
    year = local_date.strftime("%Y")
    month = local_date.strftime("%m")
    day = local_date.strftime("%d")
    return f"https://servicios.noticiasperu.pe/medios/radio/{year}/{month}/{day}/{id_pauta_radio}.mp3"

def download_file(url, filename, max_retries=3):
    retries = 0
    while retries < max_retries:
        try:
            r = requests.get(url, timeout=30)
            if r.status_code == 200:
                with open(filename, "wb") as f:
                    f.write(r.content)
                logger.info(f"Downloaded file: {filename}")
                return True
            else:
                logger.warning(f"Download failed {r.status_code} for {url}")
        except requests.RequestException as e:
            logger.warning(f"Download attempt {retries+1} error: {e}")
        retries += 1
        time.sleep(3)
    logger.error(f"Failed to download {url} after {max_retries} attempts")
    return False

def convert_mp4_to_mp3(mp4_path, mp3_path):
    try:
        with VideoFileClip(mp4_path) as video:
            audio = video.audio
            audio.write_audiofile(mp3_path, verbose=False, logger=None)
            audio.close()
        logger.info(f"Converted {mp4_path} -> {mp3_path}")
        return True
    except Exception as e:
        logger.exception(f"Error converting mp4 to mp3: {e}")
        return False

def download_youtube_video(url, output_dir, max_retries=3, delay=5):
    """
    Descarga audio de YouTube basado en función que funciona con FB
    """
    import subprocess
    
    for attempt in range(max_retries):
        try:
            logger.info(f"Downloading YouTube audio: attempt {attempt+1}/{max_retries} url={url}")
            
            # Configuración específica para YouTube (adaptada de tu función que funciona)
            ydl_opts = {
                'format': 'bestaudio[ext=m4a]/bestaudio/best',
                'outtmpl': os.path.join(output_dir, '%(id)s.%(ext)s'),
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'http_headers': {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                },
            }

            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                video_id = info['id']
                mp3_file = os.path.join(output_dir, f"{video_id}.mp3")

                # Si no se generó el MP3, intentar conversión manual (como en tu función)
                if not os.path.exists(mp3_file):
                    logger.info("MP3 no generado automáticamente, intentando conversión manual...")
                    
                    # Buscar archivo descargado
                    video_file = None
                    for ext in ['mp4', 'webm', 'mkv', 'm4a']:
                        temp_file = os.path.join(output_dir, f"{video_id}.{ext}")
                        if os.path.exists(temp_file):
                            video_file = temp_file
                            logger.info(f"Encontrado archivo: {temp_file}")
                            break

                    if video_file and os.path.exists(video_file):
                        # Intentar extracción de audio con FFmpeg (métodos de tu función)
                        ffmpeg_commands = [
                            # Método 1: Extracción directa
                            f'ffmpeg -i "{video_file}" -vn -acodec libmp3lame -ab 192k "{mp3_file}" -y',
                            # Método 2: Forzar codec pcm_s16le
                            f'ffmpeg -i "{video_file}" -vn -acodec pcm_s16le -ar 44100 -ac 2 "temp_audio.wav" -y && ffmpeg -i "temp_audio.wav" -acodec libmp3lame -ab 192k "{mp3_file}" -y',
                            # Método 3: Usar AAC como intermediario
                            f'ffmpeg -i "{video_file}" -vn -acodec aac -strict experimental "temp_audio.aac" -y && ffmpeg -i "temp_audio.aac" -acodec libmp3lame -ab 192k "{mp3_file}" -y',
                        ]

                        success = False
                        for i, cmd in enumerate(ffmpeg_commands):
                            try:
                                logger.info(f"Intentando FFmpeg método {i+1}...")
                                result = subprocess.run(cmd, shell=True, check=True, 
                                                      stderr=subprocess.PIPE, stdout=subprocess.PIPE,
                                                      cwd=output_dir)
                                
                                if os.path.exists(mp3_file) and os.path.getsize(mp3_file) > 0:
                                    logger.info(f"✅ FFmpeg método {i+1} exitoso")
                                    success = True
                                    break
                            except subprocess.CalledProcessError as e:
                                logger.warning(f"FFmpeg método {i+1} falló: {e.stderr.decode()}")
                                continue

                        # Limpiar archivos temporales
                        for temp_file in [os.path.join(output_dir, 'temp_audio.wav'), 
                                        os.path.join(output_dir, 'temp_audio.aac')]:
                            if os.path.exists(temp_file):
                                os.remove(temp_file)

                        # Limpiar archivo de video original
                        if os.path.exists(video_file):
                            os.remove(video_file)
                            logger.info(f"Archivo original eliminado: {video_file}")

                        if not success:
                            raise Exception("No se pudo extraer el audio después de múltiples intentos con FFmpeg")

                if not os.path.exists(mp3_file):
                    raise Exception("No se pudo crear el archivo MP3")

                logger.info(f"✅ Descarga exitosa: {mp3_file}")
                return mp3_file

        except ytdlp_utils.ExtractorError as e:
            error_msg = str(e).lower()
            if 'private' in error_msg:
                logger.error("Video is private")
                return None
            elif 'unavailable' in error_msg:
                logger.error("Video is unavailable")
                return None
            elif 'forbidden' in error_msg or '403' in error_msg:
                logger.warning(f"YouTube blocked request (attempt {attempt+1}): {e}")
            else:
                logger.warning(f"yt-dlp extractor error (attempt {attempt+1}): {e}")
                
        except Exception as e:
            logger.warning(f"yt-dlp general error (attempt {attempt+1}): {e}")
            
        # Cleanup en caso de error
        try:
            # Buscar y limpiar archivos parciales
            for file in os.listdir(output_dir):
                if any(ext in file for ext in ['.part', '.tmp', '.temp']):
                    os.remove(os.path.join(output_dir, file))
        except:
            pass
            
        if attempt < max_retries - 1:
            wait_time = delay * (attempt + 1)
            logger.info(f"Waiting {wait_time} seconds before retry...")
            time.sleep(wait_time)
    
    logger.error(f"Failed to download {url} after {max_retries} attempts")
    return None
# -------------------------
# Transcription (Deepgram)
# -------------------------
def transcribe_audio_with_deepgram(audio_file, timeout=600):
    if not DEEPGRAM_API_KEY:
        logger.error("DEEPGRAM_API_KEY no configurada")
        return ""
    try:
        url = "https://api.deepgram.com/v1/listen"
        headers = {"Authorization": f"Token {DEEPGRAM_API_KEY}", "Content-Type": "audio/mpeg"}
        params = {"model": "nova-2", "language": "es", "smart_format": "true"}
        with open(audio_file, "rb") as f:
            data = f.read()
        r = requests.post(url, headers=headers, params=params, data=data, timeout=timeout)
        logger.info(f"Deepgram response: {r.status_code}")
        if r.status_code == 200:
            resp = r.json()
            transcript = resp.get('results', {}).get('channels', [])[0].get('alternatives', [])[0].get('transcript', "")
            return transcript
        else:
            logger.error(f"Deepgram error {r.status_code}: {r.text}")
            return ""
    except Exception as e:
        logger.exception(f"Deepgram exception: {e}")
        return ""

# -------------------------
# GPT helpers (OpenAI) - opcional
# -------------------------
def split_text(text, max_tokens=8000):
    sentences = text.split('. ')
    chunks = []
    current = []
    current_tokens = 0
    for s in sentences:
        tcount = len(s.split())
        if current_tokens + tcount > max_tokens:
            chunks.append('. '.join(current))
            current = [s]
            current_tokens = tcount
        else:
            current.append(s)
            current_tokens += tcount
    if current:
        chunks.append('. '.join(current))
    return chunks

def summarize_text_with_gpt(text, max_retries=3):
    if client is None:
        logger.warning("OpenAI not configured - returning short excerpt as summary")
        return (text[:400] + "...") if len(text) > 400 else text
    retries = 0
    prompt = "Genera un resumen muy conciso y preciso de la siguiente noticia, que ocurre en Perú a menos que se mencione explícitamente otro país. El resumen debe tener un máximo de 3 oraciones."
    while retries < max_retries:
        try:
            chunks = split_text(text)
            summaries = []
            for ch in chunks:
                response = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role":"system","content":prompt},{"role":"user","content":ch}],
                    max_tokens=150
                )
                summaries.append(response.choices[0].message.content.strip())
            return " ".join(summaries)
        except Exception as e:
            logger.warning(f"GPT summarize attempt {retries+1} failed: {e}")
            retries += 1
            time.sleep(2)
    return ""

def generar_titular_con_gpt(text, max_retries=3):
    if client is None:
        return (text[:60] + "...") if len(text) > 60 else text
    retries = 0
    prompt = "Genera un titular conciso y atractivo para la siguiente noticia, que se asume ocurre en Perú a menos que se especifique lo contrario."
    while retries < max_retries:
        try:
            response = client.chat.completions.create(
                model="gpt-3.5-turbo-1106",
                messages=[{"role":"system","content":prompt},{"role":"user","content":text}],
                max_tokens=60
            )
            return response.choices[0].message.content.strip()
        except Exception as e:
            logger.warning(f"Titular attempt {retries+1} failed: {e}")
            retries += 1
            time.sleep(2)
    return ""

# -------------------------
# Entidades, clasificación y keywords (manteniendo tu lógica)
# -------------------------
def extract_entities(text):
    if client is None:
        # fallback: very simple regex-based entity extraction (names + all caps words)
        persons = re.findall(r"\b[A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2}\b", text)[:10]
        orgs = list(set(re.findall(r"\b[AA-Z0-9]{2,}\b", text)))[:10]
        return {"Personas": persons, "Organizaciones": orgs}
    try:
        prompt = f"""
        Identifica y lista las entidades en el siguiente texto, clasificándolas en las siguientes categorías:
        - Personas
        - Organizaciones
        - Ubicaciones
        - Países
        - Productos

        Reglas:
        1. Usa el formato "Entidad1, Entidad2, ..."
        2. Corrige los errores ortográficos en los nombres de las entidades.
        3. Usa mayúsculas iniciales para nombres propios.
        4. Si no hay entidades para una categoría, omítela.
        5. Presta especial atención a las entidades peruanas.

        Texto: {text[:2000]}
        """
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role":"system","content":"Eres un asistente experto en identificación y corrección de entidades nombradas, con conocimiento especial sobre Perú."},{"role":"user","content":prompt}],
            max_tokens=300
        )
        entities_response = response.choices[0].message.content.strip()
        entities = {}
        for line in entities_response.split('\n'):
            if ':' in line:
                category, items = line.split(':', 1)
                # Limpiar categoría de asteriscos
                category = category.strip().replace('*', '')
                # Limpiar elementos de asteriscos y espacios extra
                clean_items = []
                for item in items.split(','):
                    clean_item = item.strip().replace('*', '').strip()
                    if clean_item:
                        clean_items.append(clean_item)
                entities[category] = clean_items
        return entities
    except Exception as e:
        logger.exception(f"Error extracting entities: {e}")
        return {}

def classify_theme(text):
    # For brevity reuse a small set: in production use your category list
    categories = [ "Tecnología y Transformación Digital", "Ciberseguridad", "Gestión de Residuos Sólidos y Medio Ambiente", 
        "Salud Pública y Sistema de Salud", "Comercio Electrónico", "Telecomunicaciones", 
        "Reclutamiento y Contratación de Personal", "Higiene y Desinfección", 
        "Regulación de Productos Alimenticios", "Industria Alimentaria", "Economía Local", 
        "Consultoría Empresarial", "Pensiones", "Gestión Financiera", "Seguridad Vial", 
        "Gobierno Regional y Local", "Transporte y Movilidad Urbana", "Energía Eléctrica", 
        "Servicios Financieros", "Bienes Raíces", "Marketing", "Redes Sociales", 
        "Logística y Transporte", "Arrendamiento de Vehículos", "Transporte Ferroviario", 
        "Educación Superior", "Educación Escolar", "Diversificación Empresarial", "Política", "Industria Cosmética", 
        "Regulaciones Gubernamentales", "Sostenibilidad Empresarial", 
        "Productos de Limpieza e Higiene Personal", "Seguros", "Seguridad Pública", "Retail", 
        "Fabricación de Vehículos", "Industria Manufacturera", "Nutrición y Alimentación Saludable", 
        "Seguridad Alimentaria", "Cooperación con el Sector Privado", "Cooperación Internacional", 
        "Ayuda Humanitaria", "Desarrollo Social", "Prevención y Gestión de Desastres", 
        "Reparto de Alimentos y Bebidas", "Deportes", "Minería", 
        "Infraestructura Vial", "Legislación de Transporte", "Regulaciones y Protección al Consumidor", 
        "Diversidad, Equidad e Inclusión (DEI)", "Supermercados y Sindicatos", "Farándula", "Cine", 
        "Consumo de Alcohol y Bebidas Alcohólicas", "Alcohol Ilegal y Actividades Ilícitas", "Bebidas", 
        "Agricultura y Agroindustria", "Salud y Farmacéutica", "Tabaco y Regulación", 
        "Entretenimiento Audiovisual y Plataformas de Streaming", "Electrodomésticos y Línea Blanca", 
        "Samsung Corporativo y Competencia en la Industria Tecnológica", 
        "Samsung en el Sector Empresarial y Alianzas Estratégicas B2B", 
        "Prácticas Corporativas y Responsabilidad Empresarial", "Construcción", 
        "Industria de Alimentos y Restaurantes", "Seguridad Laboral en la Industria de Restaurantes", 
        "Hidrocarburos", "Saneamiento", "Comunicación Corporativa y Relaciones Públicas", "Inmobiliario", 
        "Centros Comerciales", "Mercado Financiero y Bolsa de Valores", "Pesca", "Clima",
        "Artes y Cultura", "Literatura y Crítica Literaria","Aplicaciones de Transporte Urbano",        "Política Internacional", "Relaciones Diplomáticas", "Conflictos Internacionales",
        "Derechos Humanos", "Migración y Refugiados", "Cambio Climático y Medio Ambiente",
        "Energías Renovables", "Innovación Tecnológica", "Inteligencia Artificial",
        "Blockchain y Criptomonedas", "Startups y Emprendimiento", "Economía Digital",
        "Mercado Laboral", "Sindicalismo y Derechos Laborales", "Igualdad de Género",
        "Derechos LGBTQ+", "Movimientos Sociales", "Activismo",
        "Educación Superior", "Investigación Científica", "Salud Mental",
        "Medicina Alternativa", "Fitness y Bienestar", "Nutrición y Dietas",
        "Gastronomía", "Turismo y Viajes", "Hotelería",
        "Moda y Tendencias", "Belleza y Cosméticos", "Lujo y Estilo de Vida",
        "Arquitectura y Diseño", "Arte Contemporáneo", "Música",
        "Teatro y Artes Escénicas", "Festivales Culturales", "Patrimonio Cultural",
        "Religión y Espiritualidad", "Filosofía y Ética", "Psicología",
        "Sociología", "Antropología", "Historia",
        "Arqueología", "Paleontología", "Astronomía y Exploración Espacial",
        "Física y Matemáticas", "Biología y Genética", "Química",
        "Oceanografía", "Geología", "Meteorología",
        "Aviación", "Transporte Marítimo", "Vehículos Autónomos",
        "Robótica", "Internet de las Cosas (IoT)", "Realidad Virtual y Aumentada",
        "Videojuegos y eSports", "Redes 5G", "Ciberseguridad Nacional",
        "Espionaje y Inteligencia", "Terrorismo y Contrainsurgencia", "Seguridad Nacional",
        "Fuerzas Armadas", "Industria de Defensa", "Política Monetaria",
        "Inflación y Deflación", "Comercio Internacional", "Acuerdos Comerciales",
        "Propiedad Intelectual", "Derecho Internacional", "Justicia y Sistema Judicial",
        "Reforma Penitenciaria", "Crimen Organizado", "Narcotráfico",
        "Corrupción y Transparencia", "Lobby y Grupos de Interés", "Elecciones y Sistemas Electorales",
        "Partidos Políticos", "Monarquía y Nobleza", "Gobierno y Administración Pública",
        "Desarrollo Urbano", "Smart Cities", "Transporte Público",
        "Movilidad Sostenible", "Urbanismo", "Vivienda Social",
        "Pobreza y Desigualdad", "Programas Sociales", "Tercera Edad y Envejecimiento",
        "Juventud", "Infancia y Derechos del Niño", "Familia y Relaciones",
        "Matrimonio y Divorcio", "Adopción", "Reproducción Asistida",
        "Sexualidad", "Educación Sexual", "Planificación Familiar",
        "Aborto y Derechos Reproductivos", "Violencia de Género", "Acoso y Abuso",
        "Trata de Personas", "Trabajo Infantil", "Explotación Laboral",
        "Sindicatos", "Huelgas y Protestas", "Negociaciones Colectivas",
        "Reformas Laborales", "Teletrabajo", "Automatización y Futuro del Trabajo",
        "Industria 4.0", "Nanotecnología", "Biotecnología",        "Ingeniería Genética", "Clonación", "Medicina Regenerativa",
        "Trasplantes", "Enfermedades Raras", "Epidemias y Pandemias",
        "Vacunas", "Antibióticos y Resistencia", "Salud Reproductiva",
        "Maternidad y Paternidad", "Crianza", "Educación Infantil",
        "Bullying y Acoso Escolar", "Educación Especial", "Aprendizaje en Línea",
        "Homeschooling", "Educación Continua", "Formación Profesional",
        "Idiomas y Multilingüismo", "Intercambio Cultural", "Globalización",
        "Nacionalismo", "Separatismo", "Movimientos Independentistas",
        "Colonialismo y Postcolonialismo", "Imperialismo", "Geopolítica",
        "Fronteras y Territorios", "Recursos Naturales", "Agua y Saneamiento",
        "Desertificación", "Deforestación", "Biodiversidad",
        "Conservación de Especies", "Parques Nacionales", "Ecoturismo",
        "Contaminación", "Reciclaje", "Economía Circular",
        "Consumo Responsable", "Comercio Justo", "Responsabilidad Social Corporativa",
        "Ética Empresarial", "Gobierno Corporativo", "Inversión Socialmente Responsable",
        "Microfinanzas", "Inclusión Financiera", "Banca Ética",
        "Cooperativas", "Economía Social", "Voluntariado",
        "ONG y Organizaciones Sin Fines de Lucro", "Filantropía", "Mecenazgo",
        "Crowdfunding", "Economía Colaborativa", "Trueque y Monedas Alternativas",
        "Economía Informal", "Evasión Fiscal", "Paraísos Fiscales",
        "Blanqueo de Capitales", "Cibercrimen", "Hacktivismo",
        "Privacidad y Protección de Datos", "Big Data", "Analítica de Datos",
        "Machine Learning", "Computación Cuántica", "Supercomputación",
        "Otros"]
    if client is None:
        # simple keyword matching fallback
        lower = text.lower()
        found = []
        if "gobierno" in lower or "presidente" in lower: found.append("Política")
        if "econom" in lower or "inflación" in lower: found.append("Economía")
        if "salud" in lower or "hospital" in lower: found.append("Salud Pública")
        if "tecnolog" in lower or "app" in lower: found.append("Tecnología")
        if "partido" in lower and "gol" in lower: found.append("Deportes")
        return found[:3] if found else ["Otro"]
    try:
        prompt = f"Clasifica el tema de la siguiente transcripción en hasta tres de estas categorías: {', '.join(categories)}. Transcripción: {text[:2000]}"
        response = client.chat.completions.create(
            model="gpt-3.5-turbo-1106",
            messages=[{"role":"system","content":prompt}],
            max_tokens=120
        )
        themes = response.choices[0].message.content.strip()
        valid = [c for c in categories if c.lower() in themes.lower()]
        return valid[:3] if valid else ["Otro"]
    except Exception as e:
        logger.warning(f"Theme classify failed: {e}")
        return ["Otro"]

def cargar_palabras_clave_excel():
    ruta_excel = os.path.join(os.getcwd(), 'queries_av_3.0.xlsx')
    if not os.path.exists(ruta_excel):
        logger.warning("Keyword Excel not found")
        return {}
    wb = openpyxl.load_workbook(ruta_excel)
    hoja = wb.active
    palabras_clave = {}
    for fila in hoja.iter_rows(min_row=2, values_only=True):
        if fila and len(fila) >= 3:
            cliente, keywords, email = fila[:3]
            emails = [e.strip() for e in str(email).split(',')] if email else []
            palabras_clave.setdefault(cliente, {'palabras': [], 'email': emails})
            if keywords:
                palabras_clave[cliente]['palabras'].extend([k.strip() for k in str(keywords).split(';') if k.strip()])
    return palabras_clave

def verificar_palabras_clave(transcription, entities, themes, palabras_clave):
    coincidencias = []
    t_lower = transcription.lower()
    entities_lower = []
    if entities:
        for v in entities.values():
            entities_lower.extend([e.lower() for e in v])
    themes_lower = [t.lower() for t in themes]
    words = set(re.findall(r'\b\w+\b', t_lower))
    for cliente, info in palabras_clave.items():
        for palabra in info['palabras']:
            p = palabra.strip().lower()
            if "sector" in cliente.lower():
                if any(p == theme for theme in themes_lower):
                    coincidencias.append({'cliente': cliente, 'palabra_clave': palabra, 'tipo': 'sector'})
                    break
            else:
                if p in words or p in entities_lower:
                    coincidencias.append({'cliente': cliente, 'palabra_clave': palabra, 'tipo': 'palabra clave'})
                    break
    return coincidencias

# -------------------------
# Processing pipeline (central)
# -------------------------
def process_audio_pipeline(mp3_path, sid=None):
    """
    Dado un mp3 local:
    - transcribe con Deepgram
    - extrae entidades
    - clasifica
    - resume y genera titular con GPT si está disponible
    - devuelve un dict con resultados
    """
    try:
        if sid:
            socketio.emit('progress', {'progress': 50, 'message': 'Transcribiendo audio...'}, to=sid)
        transcription = transcribe_audio_with_deepgram(mp3_path)
        if not transcription:
            raise ValueError("Transcripción vacía o falló")

        if sid:
            socketio.emit('progress', {'progress': 65, 'message': 'Analizando texto...'}, to=sid)

        entities = extract_entities(transcription)
        themes = classify_theme(transcription)
        summary = summarize_text_with_gpt(transcription)
        titular = generar_titular_con_gpt(transcription)

        palabras_clave = cargar_palabras_clave_excel()
        coincidencias = verificar_palabras_clave(transcription, entities, themes, palabras_clave)

        result = {
            'titular': titular,
            'resumen': summary,           # ← Cambio aquí
            'entidades': entities,        # ← Cambio aquí
            'temas': themes,              # ← Cambio aquí
            'transcripcion': transcription, # ← Cambio aquí
            'coincidencias': coincidencias
        }

        if sid:
            socketio.emit('processing_done', result, to=sid)

        return result
    except Exception as e:
        logger.exception(f"process_audio_pipeline error: {e}")
        if sid:
            socketio.emit('processing_error', {'error_message': str(e)}, to=sid)
        raise

# -------------------------
# High-level orchestration: handling id_pauta / youtube
# -------------------------
def get_pauta_audio_file(id_pauta, tipo_pauta):
    """
    Descarga y devuelve la ruta del mp3 (local) o None.
    """
    try:
        conn = connect_to_db()
        if not conn:
            raise ConnectionError("No se pudo conectar a la base de datos")
        cursor = conn.cursor()
        if tipo_pauta == 'tv':
            record = fetch_record_by_id_pauta_tv(cursor, id_pauta)
        elif tipo_pauta == 'radio':
            record = fetch_record_by_id_pauta_radio(cursor, id_pauta)
        else:
            record = None
        cursor.close()
        conn.close()
        if not record:
            raise ValueError("Registro no encontrado en DB")
        if tipo_pauta == 'tv':
            url = build_url_tv(record)
            mp4_tmp = os.path.join(DOWNLOAD_FOLDER, f"{id_pauta}.mp4")
            mp3_tmp = os.path.join(DOWNLOAD_FOLDER, f"{id_pauta}.mp3")
            if download_file(url, mp4_tmp):
                if convert_mp4_to_mp3(mp4_tmp, mp3_tmp):
                    os.remove(mp4_tmp)
                    return mp3_tmp
                else:
                    raise ValueError("Error convirtiendo MP4 a MP3")
            else:
                raise ValueError("Error descargando MP4")
        elif tipo_pauta == 'radio':
            url = build_url_radio(record)
            mp3_tmp = os.path.join(DOWNLOAD_FOLDER, f"{id_pauta}.mp3")
            if download_file(url, mp3_tmp):
                return mp3_tmp
            else:
                raise ValueError("Error descargando MP3")
    except Exception as e:
        logger.exception(f"get_pauta_audio_file failed: {e}")
        return None
@app.route('/')
def root():
    print("🔥 ROOT ROUTE CALLED!")
    logger.info("Root route accessed")
    return {"message": "Backend is working!", "port": 5001}

@app.route('/health')  
def health_check():
    print("🔥 HEALTH ROUTE CALLED!")
    logger.info("Health route accessed")
    return {"status": "Backend running", "cors": "OK", "port": 5001}

# -------------------------
# Socket auth helper
# -------------------------
def verify_clerk_token(token):
    """
    Intenta verificar token con Clerk SDK (si está disponible).
    Si Clerk no está configurado o falla la verificación, devuelve False.
    """
    if not token:
        return False
    if clerk is None:
        logger.info("Clerk SDK no disponible, omitiendo verificación del token (modo desarrollo).")
        return True  # permitir para pruebas locales
    try:
        session = clerk.sessions.verify(token)
        logger.info(f"Clerk session verified: user_id={session.get('user_id')}")
        return True
    except Exception as e:
        logger.warning(f"Clerk token verification failed: {e}")
        return False

# -------------------------
# Socket.IO events
# -------------------------
@socketio.on('connect')
def on_connect(auth):
    """
    auth: espera {'token': '<clerk_jwt>'} si el frontend envia auth al conectar.
    """
    sid = request.sid
    logger.info(f"Socket connected: sid={sid}")
    token = None
    try:
        if isinstance(auth, dict):
            token = auth.get('token')
        # verificar token (si falla, se rechaza la conexión)
        if CLERK_SECRET_KEY:
            ok = verify_clerk_token(token)
            if not ok:
                logger.warning(f"Rejecting socket connection for sid={sid} due to invalid clerk token")
                return False  # rechaza conexión
    except Exception as e:
        logger.exception(f"Error in connect auth: {e}")
        # para desarrollo no bloquear, pero si CLERK configurado, rechazamos
        if CLERK_SECRET_KEY:
            return False
    # conexión aceptada
    emit('connect_ack', {'message': 'connected', 'sid': sid})

@socketio.on('start_processing')
def on_start_processing(data):
    """
    Evento desde cliente socket para iniciar el procesamiento.
    data debe contener:
      - tipo_pauta: 'youtube' | 'tv' | 'radio'
      - id_pauta (si aplica)
      - youtube_url (si aplica)
    """
    sid = request.sid
    logger.info(f"Received start_processing from sid={sid} data={data}")
    socketio.start_background_task(target=background_task_handler, data=data, sid=sid)

# -------------------------
# HTTP endpoint para iniciar (alternativa)
# -------------------------
@app.route("/start", methods=["POST"])
def start_via_http():
    """
    Endpoint POST para iniciar el procesamiento si no se usa socket.
    Retorna {status: 'processing_started', sid: null}
    """
    payload = request.json or {}
    logger.info(f"HTTP /start called with payload: {payload}")
    # Para HTTP no tenemos sid -> usamos None pero emitaremos a todos si necesario.
    socketio.start_background_task(target=background_task_handler, data=payload, sid=None)
    return jsonify({"status": "processing_started"})

# -------------------------
# Background orchestrator
# -------------------------
def background_task_handler(data, sid=None):
    """
    Orquesta el flujo completo:
    - descarga (youtube o pauta)
    - transcribe + procesa
    - emite progreso y resultado al sid (si existe)
    """
    tipo_pauta = data.get('tipo_pauta')
    id_pauta = data.get('id_pauta')
    youtube_url = data.get('youtube_url')

    temp_files = []
    try:
        logger.info(f"Starting pipeline: tipo={tipo_pauta} id={id_pauta} youtube={youtube_url} sid={sid}")
        if sid:
            socketio.emit('progress', {'progress': 5, 'message': 'Iniciando procesamiento...'}, to=sid)

        mp3_path = None

        # if youtube -> download
        if tipo_pauta == 'youtube':
            if not youtube_url:
                raise ValueError("No se proporcionó URL de YouTube")
            
            if sid:
                socketio.emit('progress', {'progress': 10, 'message': 'Conectando con YouTube...'}, to=sid)
            
            # Validar URL básica
            if 'youtube.com' not in youtube_url and 'youtu.be' not in youtube_url:
                raise ValueError("URL inválida. Debe ser un enlace de YouTube")
            
            if sid:
                socketio.emit('progress', {'progress': 15, 'message': 'Descargando audio de YouTube...'}, to=sid)
            
            # Intentar descarga con mejor manejo de errores
            mp3_path = download_youtube_video(youtube_url, DOWNLOAD_FOLDER, max_retries=5, delay=3)
            
            if not mp3_path:
                # Error específico para YouTube
                error_msg = """No se pudo descargar el video de YouTube. Posibles causas:
                • El video es privado o fue eliminado
                • YouTube está bloqueando la descarga
                • El video tiene restricciones de edad
                • Problemas de conectividad
                
                Sugerencias:
                • Intenta con otro video
                • Verifica que el video sea público
                • Usa videos más antiguos o menos populares"""
                
                if sid:
                    socketio.emit('processing_error', {'error_message': error_msg}, to=sid)
                raise ValueError("Descarga de YouTube falló")
            
            temp_files.append(mp3_path)
            if sid:
                socketio.emit('progress', {'progress': 25, 'message': 'Audio de YouTube descargado exitosamente'}, to=sid)
                socketio.emit('audio_ready', {'mp3': mp3_path}, to=sid)

        # if tv or radio -> get from DB service
        elif tipo_pauta in ('tv', 'radio'):
            if not id_pauta:
                raise ValueError("No se proporcionó ID de pauta")
            
            if sid:
                socketio.emit('progress', {'progress': 10, 'message': f'Conectando con base de datos...'}, to=sid)
                socketio.emit('progress', {'progress': 15, 'message': f'Obteniendo audio de {tipo_pauta.upper()}...'}, to=sid)
            
            mp3_path = get_pauta_audio_file(id_pauta, tipo_pauta)
            
            if not mp3_path:
                error_msg = f"""No se pudo obtener el archivo de {tipo_pauta.upper()}. Posibles causas:
                • El ID de pauta no existe: {id_pauta}
                • El archivo no está disponible en el servidor
                • Problemas de conectividad con la base de datos
                • El archivo fue movido o eliminado"""
                
                if sid:
                    socketio.emit('processing_error', {'error_message': error_msg}, to=sid)
                raise ValueError(f"No se pudo obtener el archivo de pauta {tipo_pauta}")
            
            temp_files.append(mp3_path)
            if sid:
                socketio.emit('progress', {'progress': 25, 'message': f'Audio de {tipo_pauta.upper()} obtenido exitosamente'}, to=sid)
                socketio.emit('audio_ready', {'mp3': mp3_path}, to=sid)
        else:
            raise ValueError("Tipo de pauta no válido. Debe ser 'youtube', 'tv' o 'radio'")

        # procesar audio (transcripción, resumen, etc)
        if sid:
            socketio.emit('progress', {'progress': 30, 'message': 'Audio obtenido, iniciando transcripción...'}, to=sid)

        result = process_audio_pipeline(mp3_path, sid=sid)
        logger.info(f"Processing finished for sid={sid}")

        # cleanup temp files
        for fpath in temp_files:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
                    logger.info(f"Removed temp file: {fpath}")
            except Exception:
                logger.exception(f"Error removing temp file: {fpath}")

        return result

    except ValueError as e:
        # Errores de validación - ya tienen mensajes específicos
        logger.error(f"Validation error: {e}")
        if sid and 'processing_error' not in str(e):  # Evitar doble envío
            socketio.emit('processing_error', {'error_message': str(e)}, to=sid)
        # cleanup temp files
        for fpath in temp_files:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception:
                logger.exception(f"Error removing temp file: {fpath}")
        return None
        
    except Exception as e:
        # Errores inesperados
        logger.exception(f"background_task_handler unexpected error: {e}")
        error_msg = f"Error inesperado durante el procesamiento: {str(e)}"
        if sid:
            socketio.emit('processing_error', {'error_message': error_msg}, to=sid)
        # cleanup temp files
        for fpath in temp_files:
            try:
                if os.path.exists(fpath):
                    os.remove(fpath)
            except Exception:
                logger.exception(f"Error removing temp file: {fpath}")
        return None
# -------------------------
# Run
# -------------------------
if __name__ == "__main__":
    os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)
    
    # Debugging: mostrar todas las rutas registradas
    print("=== RUTAS REGISTRADAS ===")
    for rule in app.url_map.iter_rules():
        print(f"Ruta: {rule.rule} -> {rule.endpoint}")
    print("========================")
    
    # Volver al puerto 5000 por simplicidad
    logger.info("Starting Flask + SocketIO server on localhost:5000")
    socketio.run(app, host="localhost", port=5000, debug=True)
