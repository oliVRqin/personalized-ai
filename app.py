from flask import Flask, request
from flask_cors import CORS
from secrets_1 import openaikey
from pydub import AudioSegment
from pydub.playback import play
from openai import OpenAI
import os
import tempfile
import io

client = OpenAI(api_key=openaikey)

app = Flask(__name__)
CORS(app)

@app.route('/chat', methods=['POST'])
def chat():
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
        print("Received a transcript:", transcript.text)

        systemPrompt = {
            "role": "system", 
            "content": "You are an assistant which responds to me in a conversational tone but with concise answers, within 500 characters."
        }
        userPrompt = {
            "role": "user", 
            "content": transcript.text
        };

        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[systemPrompt, userPrompt]
        )

        print("Number of total tokens used for GPT response step: ", response.usage.total_tokens)
        print("Received a response: ", response.choices[0].message.content)

        # TO-DO: Cache and store the response so that it could be used in a future conversation

        audio_response = client.audio.speech.create(
            model="tts-1",
            voice="onyx",
            input=response.choices[0].message.content
        )  

        print("Received an audio response: ", audio_response)

        bytes = io.BytesIO(audio_response.content)

        play(AudioSegment.from_file(bytes, format="mp3"))

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
