import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [responseCounter, setResponseCounter] = useState<number>(0);
  const [isLoadingResponse, setIsLoadingResponse] = useState<boolean>(false);
  const audioChunksRef = useRef<Array<BlobPart>>([]);
  const [messages, setMessages] = useState<any[]>([]);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const captureSnapshot = () => {
    return new Promise((resolve, reject) => {
      if (videoRef.current && videoRef.current.srcObject) {
        const canvas = document.createElement('canvas');
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        try {
          const dataURL = canvas.toDataURL('image/jpeg');
          resolve(dataURL); 
          // Turns off just the audio from the webcam
          const stream = videoRef.current.srcObject as MediaStream;
          const tracks = stream.getTracks();
          tracks.forEach((track) => {
            if (track.kind === 'audio') {
              track.stop();
            }
          });
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error("Video element not found"));
      }
    });
  };

  const scrollToBottom = () => {
    const current = messagesEndRef.current;
    if (current) {
      current.scrollTop = current.scrollHeight;
    }
  };

  const renderMessage = (message: any, index: any) => {
    const messageBoxClass = message.author === 'speaker' 
      ? 'bg-blue-500 text-white rounded-lg rounded-br-none float-right clear-both' 
      : 'bg-gray-300 text-black rounded-lg rounded-bl-none float-left clear-both';

    return (
      <div key={index} className={`max-w-xs w-auto px-4 py-2 my-1 ${messageBoxClass}`}>
        {message.text}
      </div>
    );
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper function to create FormData
  const createAudioFormData = (audioBlob: any, fileName: any) => {
    const formData = new FormData();
    formData.append('file', new File([audioBlob], fileName, { type: "audio/mp4" }));
    return formData;
  };

  const addMessage = (text: string, author: string) => {
    setMessages(prevMessages => [...prevMessages, { text, author }]);
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
      addMessage(data, 'speaker');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const sendImagePromptToPython = async (imageURL: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_DEV_ENDPOINT_URL}/analyze-image`, {
          method: 'POST',
          body: imageURL
      });
      if (!response.ok) {
          throw new Error('Network response was not ok');
      }
      const data = await response.text();
      // works, GPT responds back
      console.log("data from image prompt: ", data)
      addMessage(data, 'other');
    } catch (error) {
      console.error('Error:', error);
    }
  }

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
      addMessage(data, 'other');
    } catch (error) {
      console.error('Error:', error);
      setIsLoadingResponse(false);
    }
  };

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: false, video: true })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
  }, [])

  useEffect(() => {
    if (isRecording) {
      navigator.mediaDevices.getUserMedia({ audio: true, video: true })
        .then(stream => {
          mediaRecorderRef.current = new MediaRecorder(stream);
          mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
          };
          mediaRecorderRef.current.start(1000);

          // trigger snapshot after I start recording to pass to backend and see image data to analyze
          setTimeout(async () => {
            try {
              const imageDataURL = await captureSnapshot();
              console.log('Captured Image Data URL:', imageDataURL);
              sendImagePromptToPython(imageDataURL as string);
            } catch (error) {
              console.error("Error capturing snapshot:", error);
            }
          }, 100);
          /* if (videoRef.current) {
            videoRef.current.srcObject = stream;
          } */
        });
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = async () => {
        try {
          // Process the audio recording
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mp4' });
          const audioUrl = URL.createObjectURL(audioBlob);
          console.log('Audio File:', audioUrl);
          if (audioBlob) {
            printTranscript(audioBlob);
            sendAudioPromptToPython(audioBlob);
          }
          audioChunksRef.current = [];
        } catch (error) {
          console.error("Error capturing snapshot:", error);
        }
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
    <main className={`flex min-h-screen flex-col items-center justify-between pt-8 pb-24 bg-gray-100`}>
      <div className='justify-center items-center flex flex-col pb-4'>
        <video ref={videoRef} autoPlay style={{ width: '500px', height: '370px' }}></video>
      </div>
      <div className="flex flex-col items-center justify-center w-full md:w-1/2">
        <div ref={messagesEndRef} className={`w-[500px] md:h-60 border-2 border-black overflow-y-auto p-4 bg-white shadow rounded-lg ${messages.length === 0 && `justify-center items-center text-center md:h-auto p-8`}`}>
          {
            messages.length === 0 
              ?
                <div className='mt-6'>
                  <p className='font-bold text-lg pb-3'>Chat with your AI therapist!</p>
                  <p>1. Click on &quot;Start Recording&quot; to talk with the AI.</p>
                  <p>2. When you&apos;re done, click &quot;Stop Recording&quot; to wait for the AI&apos;s response.</p>
                </div>
              :
                messages.map((message, index) => renderMessage(message, index))
          }
        </div>
      </div>
      {isLoadingResponse && <p className="text-lg">Generating response...</p>}
      <button onClick={toggleRecording} className={`${!isRecording ? "bg-green-600" : "bg-red-600"} px-5 py-3 rounded-lg text-white mt-4`}>
        {isRecording ? "Stop Recording" : "Start Recording"}
      </button>
    </main>
  );
}

