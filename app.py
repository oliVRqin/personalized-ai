from flask import Flask
from flask_cors import CORS
from pydub.playback import play
from pydub import AudioSegment
from secrets_1 import openaikey

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return 'Hello world'

if __name__ == '__main__':
    app.run(debug=True)
