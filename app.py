import requests
from flask import Flask, request, send_file
from flask_cors import CORS
from openai import OpenAI
import os
import traceback
import tempfile
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

client = OpenAI(api_key=OPENAI_API_KEY)

app = Flask(__name__)
CORS(app)

audio_file_path = 'output.mp4'

def transcribe_audio(file_storage):
    print("Transcribe audio: Starting transcription process.")
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file_storage.filename)
    file_storage.save(temp_file_path)

    try:
        with open(temp_file_path, "rb") as audio_file:
            print(f"Transcribe audio: File {file_storage.filename} saved, starting OpenAI transcription.")
            transcript = client.audio.transcriptions.create(
                model="whisper-1", 
                file=audio_file
            )
            print("Transcribe audio: Transcription completed successfully.")
    except Exception as e:
        print(f"Transcribe audio: An error occurred during transcription: {e}")
    finally:
        # Ensure cleanup is always attempted and log the attempt
        print(f"Transcribe audio: Cleaning up temporary files for {file_storage.filename}.")
        os.remove(temp_file_path)
        os.rmdir(temp_dir)
    return transcript.text if transcript else None



@app.route('/print-transcript', methods=['POST'])
def printTranscript():
    if 'file' not in request.files:
        return 'No file part', 400

    file_storage = request.files['file']
    if file_storage.filename == '':
        return 'No selected file', 400

    transcript_text = transcribe_audio(file_storage)
    if transcript_text:
        return transcript_text
    else:
        return 'Failed to transcribe audio', 500
    
@app.route('/analyze-image', methods=['POST'])
def analyzeImage():
    data_url = request.data.decode('utf-8')
    try:
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        }
        payload = {
            "model": "gpt-4-vision-preview",
            "messages": [
                {
                    "role": "system", 
                    "content": "You respond strictly with the following format template: Hmm, the subject seems to look like they're displaying <mood>"
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": "Analyze the image and determine what mood I'm displaying in one word from these choices: happiness, surprise, contempt, sadness, fear, disgust, despair, and anger."
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"{data_url}"
                            }
                        }
                    ]
                }
            ],
            "max_tokens": 300
        }
        response = requests.post("https://api.openai.com/v1/chat/completions", headers=headers, json=payload)
        result = response.json()
    except Exception as e:
        print("An error occurred:", e)
        traceback.print_exc()
        return 'Failed to transcribe audio', 500
    try:
        # Processing code
        return result["choices"][0]["message"]["content"]
    except Exception as e:
        print("An error occurred:", e)
        return 'Failed to process image', 500
    
@app.route('/chat', methods=['POST'])
def chat():
    if 'file' not in request.files:
        return 'No file part', 400

    file_storage = request.files['file']
    if file_storage.filename == '':
        return 'No selected file', 400
    
    transcript_text = transcribe_audio(file_storage)

    # Create a temporary file
    temp_dir = tempfile.mkdtemp()
    temp_file_path = os.path.join(temp_dir, file_storage.filename)
    file_storage.save(temp_file_path)

    try:
        systemPrompt = {
            "role": "system", 
            "content": "You are an AI therapist who is conversing with a human who just wants to share their experiences and thoughts with someone else. Try to be a good listener and detector of emotion, and potentially find analogies to compare with their experiences."
        }
        userPrompt = {
            "role": "user", 
            "content": transcript_text
        };

        response = client.chat.completions.create(
            model="gpt-3.5-turbo-0125",
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

        with open(audio_file_path, 'wb') as audio_file:
            audio_file.write(audio_response.content)      

    except Exception as e:
        print("An error occurred:", e)
        traceback.print_exc()
        return 'Failed to transcribe audio', 500
    finally:
        print("Cleaning up temporary files.")
        # Clean up the temporary file
        os.remove(temp_file_path)
        os.rmdir(temp_dir)
    return response.choices[0].message.content

    
@app.route('/get_audio', methods=['GET'])
def get_audio():
    print("audio path", audio_file_path)
    if not os.path.exists(audio_file_path):
        return 'Audio not found', 404

    print("Sending audio file: ", audio_file_path)
    return send_file(audio_file_path, as_attachment=True, mimetype='audio/mpeg')

@app.route('/delete_audio', methods=['DELETE'])
def delete_audio():
    try:
        os.remove(audio_file_path)
        return 'File deleted', 200
    except FileNotFoundError:
        return 'File not found', 404
    except Exception as e:
        return str(e), 500

@app.route('/')
def index():
    return 'Hello world'

if __name__ == '__main__':
    app.run(debug=True)
