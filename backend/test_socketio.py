from flask import Flask
from flask_socketio import SocketIO

app = Flask(__name__)
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route("/")
def index():
    return "Servidor Flask+Socket.IO activo"

@socketio.on('connect')
def test_connect():
    print("Cliente conectado")
    socketio.emit("message", {"data": "Conectado correctamente"})

if __name__ == '__main__':
    print("🚀 Iniciando servidor de prueba en http://127.0.0.1:5000")
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
