const constraints = {
    audio: true,
    video: true
};

async function handleGetUserMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Got MediaStream:', stream);
    }
    catch {
        console.error('Error accessing media devices.', error);
    }
}
