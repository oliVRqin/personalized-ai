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

  const startWebRTC = async () => {
    try {
      peerConnection = new RTCPeerConnection(configuration);
      console.log("peerConnection", peerConnection)
      // Request access to user's media devices
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("stream", stream)

      // Play back the obtained stream (to hear your own input)
      const audio = new Audio();
      console.log("audio", audio)
      audio.srcObject = stream;
      audio.play();
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
      peerConnection.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log("candidate", candidate)
          socketRef.current?.send(JSON.stringify({ ice: candidate }));
        }
      };
      peerConnection.ontrack = ({ streams: [stream] }) => {
        console.log("stream ontrack", stream)
        const audio = new Audio();
        audio.srcObject = stream;
        audio.play();
      };
    } catch (error) {
      console.error("Error creating peer connection: ", error);
    }
  }

  useEffect(() => {
    socketRef.current = new WebSocket(`${process.env.NEXT_PUBLIC_WEBSOCKET_ENDPOINT}`);
    console.log("WebSocket created: ", socketRef.current);
  
    socketRef.current.onopen = () => {
      console.log("WebSocket open");
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        console.log("Hello from onopen");
        startWebRTC();
      }
    };
  
    /* socketRef.current.onmessage = (event) => {
      console.log("WebSocket message received:", event);
      if (!isPaused && socketRef.current?.readyState === WebSocket.OPEN) {
        const message = event.data;
        console.log("e", message);
        socketRef.current.send("Hello from onmessage");
      }
    }; */
  
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

  let audioChunks: any = [];

  /* useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
          console.log("stream", stream)
          mediaRecorderRef.current = new MediaRecorder(stream);
          console.log("mediaRecorderRef.current", mediaRecorderRef.current)
          mediaRecorderRef.current.ondataavailable = (event: any) => {
            console.log("ondataavailable triggered: ", event)
            audioChunks.push(event.data);
          };
          mediaRecorderRef.current.onstop = () => {
              const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
              const audioBuffer = new FileReader();
              
              audioBuffer.onload = function(event) {
                const audioData = event.target?.result as ArrayBuffer;
                socketRef.current?.send(audioData);
              };
              audioBuffer.readAsArrayBuffer(audioBlob);
          };
          console.log("stream.getTracks()", stream.getTracks())
          peerConnection.addTrack(stream.getTracks()[0], stream);
      });
    console.log("updated audioChunks", audioChunks)
  }, [isPaused]); */

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
