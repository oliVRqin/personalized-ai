from flask import Flask, request
from flask_cors import CORS
from secrets_1 import openaikey
from openai import OpenAI
import os
import tempfile

client = OpenAI(api_key=openaikey)

app = Flask(__name__)
CORS(app)

@app.route('/upload_audio', methods=['POST'])
def upload_audio():
    if 'file' not in request.files:
        return 'No file part', 400

    file_storage = request.files['file']
    if file_storage.filename == '':
        return 'No selected file', 400

    # Create a temporary file
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file_storage.filename)
    file_storage.save(temp_file_path)

    transcript = None
    try:
        with open(temp_file_path, 'rb') as file:
            transcript = client.audio.transcriptions.create(
                model="whisper-1", 
                file=file
            )
        print("Received a transcript:", transcript)
    except Exception as e:
        print("An error occurred:", e)
        return 'Failed to transcribe audio', 500
    finally:
        # Clean up the temporary file
        os.remove(temp_file_path)
        os.rmdir(temp_dir)

    if transcript:
        return 'File successfully uploaded', 200
    else:
        return 'Failed to transcribe audio', 500

@app.route('/')
def index():
    return 'Hello world'

if __name__ == '__main__':
    app.run(debug=True)
