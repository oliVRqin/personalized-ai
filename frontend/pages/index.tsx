import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const socketRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [responseCounter, setResponseCounter] = useState(0);
  const [isLoadingResponse, setIsLoadingResponse] = useState(false);
  const audioChunksRef = useRef<Array<BlobPart>>([]);
  const [transcriptText, setTranscriptText] = useState<string>('');
  const [responseText, setResponseText] = useState<string>('');
  const [messages, setMessages] = useState<any[]>([]);

  const renderMessage = (message: any, index: any) => {
    const messageClass = message.author === 'speaker' 
      ? 'bg-blue-500 text-white rounded-lg rounded-br-none' 
      : 'bg-gray-300 text-black rounded-lg rounded-bl-none';

    const containerClass = message.author === 'speaker' 
      ? 'flex justify-end' 
      : 'flex justify-start';

    return (
      <div key={index} className={`max-w-xs w-full px-4 py-2 my-1 ${containerClass}`}>
        <div className={`w-auto inline-block px-4 ${messageClass}`}>
          {message.text}
        </div>
      </div>
    );
  };



  const ice_server_url = process.env.NEXT_PUBLIC_ICE_SERVER_URL

  const configuration = { iceServers: [{ urls: ice_server_url as string }] };
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

  /* useEffect(() => {
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
  }, [isPaused, peerConnection]); */

  // Helper function to create FormData
  const createAudioFormData = (audioBlob: any, fileName: any) => {
    const formData = new FormData();
    formData.append('file', new File([audioBlob], fileName, { type: "audio/mp4" }));
    return formData;
  };

  const printTranscript = async (audioBlob: any) => {
    const formData = createAudioFormData(audioBlob, "audio-example-printTranscript.mp4");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DEV_ENDPOINT_URL}/print-transcript`, {
          method: 'POST',
          body: formData
      });
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const data = await response.text();
      setTranscriptText(data); 
      messages.push({ text: data, author: 'speaker' })
      //setMessages([...messages, { text: data, author: 'other' }])
    } catch (error) {
      console.error('Error:', error);
    }
  };


  console.log("transcriptText: ", transcriptText)
  console.log("responseText: ", responseText)

  const sendAudioPromptToPython = async (audioBlob: any) => {
    const formData = createAudioFormData(audioBlob, "audio-example.mp4");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DEV_ENDPOINT_URL}/chat`, {
          method: 'POST',
          body: formData
      });
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const data = await response.text();
      setIsLoadingResponse(false);
      setResponseCounter(responseCounter + 1);
      setResponseText(data)
      messages.push({ text: data, author: 'other' })
      //setMessages([...messages, { text: data, author: 'speaker' }])
    } catch (error) {
      console.error('Error:', error);
      setIsLoadingResponse(false);
    }
  };

  useEffect(() => {
    if (isRecording) {
      console.log("mediaRecorder isRecording start")
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          mediaRecorderRef.current = new MediaRecorder(stream);
          mediaRecorderRef.current.ondataavailable = (event) => {
            console.log("mediaRecorder on dataavailable")
            audioChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.start(1000);
        });
    } else if (mediaRecorderRef.current) {
      console.log("mediaRecorder isRecording stop")
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        console.log("mediaRecorder on stopped")
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
        const audioUrl = URL.createObjectURL(audioBlob);
        console.log('Audio File:', audioUrl);
        if (audioBlob) {
          printTranscript(audioBlob)
          sendAudioPromptToPython(audioBlob)
        }
        audioChunksRef.current = [];
      };
    }
  }, [isRecording]);

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  useEffect(() => {
    if (responseCounter > 0) {
      // Fetch and play the latest audio file
      fetch(`${process.env.NEXT_PUBLIC_DEV_ENDPOINT_URL}/get_audio`)
        .then(response => response.blob())
        .then(blob => {
          const audioUrl = URL.createObjectURL(blob);
          console.log('Audio File:', audioUrl);
          const audio = new Audio(audioUrl);
          audio.play();
          // Delete the audio file when playback finishes
          audio.addEventListener('ended', () => {
            fetch(`${process.env.NEXT_PUBLIC_DEV_ENDPOINT_URL}/delete_audio`, { method: 'DELETE' })
              .then(response => {
                if (response.ok) {
                  console.log('Audio file deleted successfully.');
                }
              })
              .catch(error => console.error('Error deleting audio file:', error));
          });
        })
        .catch(error => console.error('Error fetching audio:', error));
      }
  }, [responseCounter]);
  

  return (
    <main className={`flex min-h-screen flex-col items-center justify-between p-24`}>
      <h1 className='text-2xl font-semibold'>Personalized AI</h1>
      {/* <button onClick={() => setIsPaused(!isPaused)}>
        {isPaused ? "Resume Connection" : "Pause Connection"}
      </button> */}
      <div className="flex flex-col items-center justify-center h-1/2 w-1/2">
          <div className="w-1/2 h-1/2 overflow-y-auto p-4 bg-white shadow rounded">
              {messages.map((message, index) => renderMessage(message, index))}
          </div>
        </div>
      {isLoadingResponse && <p className="text-lg">Generating response...</p>}
      <button onClick={toggleRecording} className={`${!isRecording ? "bg-green-600" : "bg-red-600"} px-5 py-3 rounded-lg text-white`}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
    </main>
  );
}

