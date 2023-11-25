import { useEffect, useState, useRef } from 'react'

export default function Home() {
  const socketRef = useRef<WebSocket | null>(null)
  const [isPaused, setIsPaused] = useState(false);

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
  
  return (
    <main className={`flex min-h-screen flex-col items-center justify-between p-24`}>
      Title
      <button onClick={() => setIsPaused(!isPaused)}>
          {isPaused ? "Resume" : "Pause"}
      </button>
    </main>
  );
}
