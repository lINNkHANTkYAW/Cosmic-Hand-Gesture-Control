import React, { useEffect, useRef, useState } from 'react';
import { FilesetResolver, GestureRecognizer, DrawingUtils } from '@mediapipe/tasks-vision';
import { useStore, GestureType } from '../store';
import { Camera } from 'lucide-react';

const HandController: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const setHandState = useStore(state => state.setHandState);
  const panCamera = useStore(state => state.panCamera);

  // Refs for logic that doesn't need re-renders
  const gestureRecognizerRef = useRef<GestureRecognizer | null>(null);
  const requestRef = useRef<number>();
  const lastVideoTimeRef = useRef<number>(-1);
  const lastWaveXRef = useRef<number>(0);
  const waveHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        
        gestureRecognizerRef.current = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        
        setLoading(false);
        startWebcam();
      } catch (err) {
        console.error(err);
        setError("Failed to load hand tracking model.");
        setLoading(false);
      }
    };

    initMediaPipe();

    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach(track => track.stop());
      }
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.addEventListener('loadeddata', predictWebcam);
      }
    } catch (err) {
      setError("Camera access denied.");
    }
  };

  const predictWebcam = () => {
    if (!videoRef.current || !gestureRecognizerRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Resize canvas to match video
    if (video.videoWidth !== canvas.width) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const nowInMs = Date.now();
    if (video.currentTime !== lastVideoTimeRef.current) {
      lastVideoTimeRef.current = video.currentTime;
      
      const results = gestureRecognizerRef.current.recognizeForVideo(video, nowInMs);

      ctx?.clearRect(0, 0, canvas.width, canvas.height);

      if (results.landmarks && results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];
        
        // --- 1. Draw Landmarks ---
        const drawingUtils = new DrawingUtils(ctx!);
        drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
          color: "#00FF00",
          lineWidth: 2
        });
        drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 1, radius: 3 });

        // --- 2. Calculate Cursor Position (Center of Palm) ---
        // Landmarks: 0 (Wrist), 5 (Index MCP), 9 (Middle MCP), 13 (Ring MCP), 17 (Pinky MCP)
        // Average of 0, 5, 17 gives a stable palm center
        const palmX = (landmarks[0].x + landmarks[5].x + landmarks[17].x) / 3;
        const palmY = (landmarks[0].y + landmarks[5].y + landmarks[17].y) / 3;

        // Invert X because webcam is mirrored
        const cursorX = (1 - palmX) * 2 - 1; 
        const cursorY = -(palmY * 2 - 1); 

        // --- 3. Gesture Detection Logic ---
        let currentGesture: GestureType = 'NONE';
        
        // Native MediaPipe classification
        const nativeGesture = results.gestures.length > 0 ? results.gestures[0][0].categoryName : 'None';

        // Custom Pinch Logic (Distance between Index Tip 8 and Thumb Tip 4)
        const pinchDist = Math.hypot(landmarks[8].x - landmarks[4].x, landmarks[8].y - landmarks[4].y);
        const isPinching = pinchDist < 0.05;

        // Wrist Rotation (Angle between wrist 0 and Index MCP 5)
        const dy = landmarks[5].y - landmarks[0].y;
        const dx = landmarks[5].x - landmarks[0].x;
        const rotation = Math.atan2(dy, dx); // Radians

        // Wave Logic
        // Track X movement history
        waveHistoryRef.current.push(palmX);
        if (waveHistoryRef.current.length > 10) waveHistoryRef.current.shift();
        const isWaving = calculateWave(waveHistoryRef.current);

        if (isWaving) {
            currentGesture = 'WAVE';
            // Trigger Camera Pan directly here if waving
            const deltaX = lastWaveXRef.current - palmX;
            panCamera(deltaX * 5); // Multiplier for sensitivity
        } else if (isPinching) {
          currentGesture = 'PINCH';
        } else if (nativeGesture === 'Closed_Fist') {
          currentGesture = 'FIST';
        } else if (nativeGesture === 'Thumb_Up') {
          currentGesture = 'THUMBS_UP';
        } else if (nativeGesture === 'Open_Palm') {
          currentGesture = 'OPEN_PALM';
        } else {
            // Default to palm if hand is mostly open but not perfectly confident
            currentGesture = 'OPEN_PALM';
        }

        lastWaveXRef.current = palmX;

        // --- 4. Update Global State ---
        setHandState(true, cursorX, cursorY, currentGesture, rotation);

      } else {
        setHandState(false, 0, 0, 'NONE', 0);
      }
    }

    requestRef.current = requestAnimationFrame(predictWebcam);
  };

  const calculateWave = (history: number[]) => {
      if (history.length < 5) return false;
      // Simple variance check: if x moves back and forth quickly
      // Or just high velocity in X direction?
      // Prompt says "Wave hand left/right".
      // Let's keep it simple: if velocity is high, it's a wave? 
      // Actually, distinct wave gesture is hard to distinguish from moving hand to grab.
      // Let's rely on mapping lateral palm position to camera pan when NO other gesture is active in the main app logic instead?
      // But user specifically requested "Wave hand left/right" gesture.
      // I'll stick to a velocity threshold for now, but give it a high bar so it doesn't trigger during drags.
      const start = history[0];
      const end = history[history.length - 1];
      const diff = Math.abs(start - end);
      return diff > 0.4; // Moved 40% of screen width quickly
  };

  return (
    <div className="fixed top-4 right-4 z-50 w-48 h-36 bg-black/50 rounded-lg overflow-hidden border border-white/20 shadow-lg backdrop-blur-sm">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-white text-xs">
          Loading AI Model...
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 text-xs p-2 text-center">
          <Camera size={24} className="mb-1" />
          {error}
        </div>
      )}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" autoPlay playsInline muted />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover transform -scale-x-100" />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-2 py-1 flex justify-between">
        <span>Webcam Feed</span>
        <span className="text-green-400 font-mono">
           {useStore.getState().gesture}
        </span>
      </div>
    </div>
  );
};

export default HandController;