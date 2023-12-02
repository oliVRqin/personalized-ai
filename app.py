from flask import Flask, request
from flask_cors import CORS
from pydub import AudioSegment
from pydub.playback import play
from openai import OpenAI
import os
import tempfile
import io
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

client = OpenAI(api_key=OPENAI_API_KEY)

app = Flask(__name__)
# CORS(app)
CORS(app, resources={r"/chat": {"origins": "https://personalized-ai.vercel.app"}})
#CORS(app, resources={r"/*": {"origins": "https://personalized-ai.vercel.app"}})

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
            "content": "You are an AI therapist who is conversing with a human who just wants to share their experiences and thoughts with someone else. Try to be a good listener and detector of emotion, and potentially find analogies to compare with their experiences."
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
