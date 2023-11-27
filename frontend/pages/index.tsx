import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const audioChunksRef = useRef<Array<BlobPart>>([]);

  const configuration = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
  let peerConnection: any = null;

  const constraints = {
    audio: true,
    video: false
  };

  const startWebRTC = async () => {
    try {
      peerConnection = new RTCPeerConnection(configuration);
      console.log("peerConnection", peerConnection)
      // Request access to user's media devices
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("stream", stream)

      stream.getTracks().forEach(track => peerConnection.addTrack(track, stream));
      peerConnection.onnegotiationneeded = async () => {
        try {
          await peerConnection.setLocalDescription(await peerConnection.createOffer());
          console.log("peerConnection.localDescription", peerConnection.localDescription)
          socketRef.current?.send(JSON.stringify({ sdp: peerConnection.localDescription }));
        } catch (error) {
          console.error("Error creating offer: ", error);
        }
      };
      peerConnection.onicecandidate = ({ candidate }: any) => {
        if (candidate) {
          console.log("candidate", candidate)
          socketRef.current?.send(JSON.stringify({ ice: candidate }));
        }
      };
      peerConnection.ontrack = ({ streams: [stream] }: any) => {
        console.log("stream ontrack", stream)
      };
    } catch (error) {
      console.error("Error creating peer connection: ", error);
    }
  }

  useEffect(() => {
    if (!isPaused) {
      socketRef.current = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT}`);
      startWebRTC();
    } else {
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.close();
      }
      if (peerConnection) {
        peerConnection.close();
      }
    }
  }, [isPaused, peerConnection]);

  const sendAudioPrompt = async (audio: any) => {
    const requestOptions = {
      method: 'POST',
      body: audio,
      headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_OPENAI_KEY}}`
      }
    };
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', requestOptions);
      console.log("sendAudioPrompt response", response)
      const data = await response.json();
      console.log("sendAudioPrompt data", data)
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  }

  const sendAudioPromptToPython = async (audioBlob: any) => {
    console.log("sendAudioPromptToPython audioBlob", audioBlob)
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio-example.mp3')
    console.log("sendAudioPromptToPython formData", formData)
    console.log("sendAudioPromptToPython formData get file", formData.get('file'));

    fetch('http://127.0.0.1:5000/upload_audio', {
        method: 'POST',
        body: formData
    })
    .then(response => response.text())
    .then(data => {
        console.log('Success:', data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
  }

  useEffect(() => {
    if (isRecording) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaRecorderRef.current = new MediaRecorder(stream);
          mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.start();
        });
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('Audio File:', audioUrl);
        const audio = new Audio(audioUrl);
        if (audioBlob) {
          sendAudioPromptToPython(audioBlob)
        }
        audio.play();
        audioChunksRef.current = [];
      };
    }
  }, [isRecording]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <main className={`flex min-h-screen flex-col items-center justify-between p-24`}>
      <div>Personalized AI</div>
      <button onClick={() => setIsPaused(!isPaused)}>
        {isPaused ? "Resume Connection" : "Pause Connection"}
      </button>
      <button onClick={toggleRecording}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
    </main>
  );
}

