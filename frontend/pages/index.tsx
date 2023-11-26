import { useEffect, useState, useRef } from 'react'

export default function Home() {
  const socketRef = useRef<WebSocket | null>(null)
  const [isPaused, setIsPaused] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const configuration = { iceServers: [{ urls: /* process.env.NEXT_PUBLIC_ICE_SERVER_URL */"stun:stun.l.google.com:19302" }] };
  let peerConnection: RTCPeerConnection;

  const constraints = {
    audio: true,
    video: false // Add video later
  };

  useEffect(() => {
    socketRef.current = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT}`);
    console.log("WebSocket created: ", socketRef.current);
  
    socketRef.current.onopen = () => {
      console.log("WebSocket open");
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send("Hello from onopen");
      }
    };
  
    socketRef.current.onmessage = (event) => {
      console.log("WebSocket message received:", event);
      if (!isPaused && socketRef.current?.readyState === WebSocket.OPEN) {
        const message = event.data;
        console.log("e", message);
        socketRef.current.send("Hello from onmessage");
      }
    };
  
    socketRef.current.onerror = (error) => {
      console.error("WebSocket Error: ", error);
    };
  
    return () => {
      console.log("WebSocket returned");
      if (socketRef.current?.readyState === WebSocket.OPEN) { 
        socketRef.current.close();
      } 
    };
  }, [isPaused]);

  let mediaRecorder: any;
        let audioChunks: any = [];

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
          console.log("stream", stream)
          mediaRecorder = new MediaRecorder(stream);
          mediaRecorder.ondataavailable = (event: any) => {
              audioChunks.push(event.data);
          };
          mediaRecorder.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
              const audioBuffer = new FileReader();
              
              audioBuffer.onload = function(event) {
                  const audioData = event.target?.result as ArrayBuffer;
                  socketRef.current?.send(audioData);
              };
              audioBuffer.readAsArrayBuffer(audioBlob);
          };
          console.log("stream.getTracks()", stream.getTracks())
          // peerConnection.addTrack(stream.getTracks()[0], stream);
      });
    console.log("updated audioChunks", audioChunks)
  }, [isPaused]);

  const handleConversation = async () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send("Hello from handleConversation");
      try {
        peerConnection = new RTCPeerConnection(configuration);
        console.log("peerConnection", peerConnection)
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
      } catch (error) {
        console.error("Error creating peer connection: ", error);
      }
      
    }
    setIsPaused(!isPaused);
  }

  /* function startRecording() {
    audioChunks = [];
    mediaRecorder.start();
  }

  function stopRecording() {
      mediaRecorder.stop();
  } */
  
  return (
    <main className={`flex min-h-screen flex-col items-center justify-between p-24`}>
      Title
      <button onClick={handleConversation}>
          {isPaused ? "Resume" : "Pause"}
      </button>
    </main>
  );
}
