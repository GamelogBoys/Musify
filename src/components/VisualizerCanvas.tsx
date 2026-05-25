import { useEffect, useRef } from "react";

interface VisualizerCanvasProps {
  analyserNode: AnalyserNode | null;
  isPlaying: boolean;
  mode: "spectrum" | "oscilloscope" | "phase";
}

export default function VisualizerCanvas({ analyserNode, isPlaying, mode }: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize observer to handle responsive parent container dimensions
    let width = canvas.width = Math.max(canvas.parentElement?.clientWidth || 600, 200);
    let height = canvas.height = Math.max(canvas.parentElement?.clientHeight || 260, 150);

    const resizeObserver = new ResizeObserver((entries) => {
      requestAnimationFrame(() => {
        if (!canvas) return;
        for (let entry of entries) {
          const { width: w, height: h } = entry.contentRect;
          const targetW = Math.max(Math.floor(w), 200);
          const targetH = Math.max(Math.floor(h), 150);
          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
            width = targetW;
            height = targetH;
          }
        }
      });
    });

    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    const bufferLength = analyserNode ? analyserNode.frequencyBinCount : 256;
    const dataArray = new Uint8Array(bufferLength);
    const peaks = new Array(bufferLength).fill(0);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      // Handle clearing with trailing fade-out for visual persistence glow
      ctx.fillStyle = "rgba(9, 9, 11, 0.22)"; // Matches zinc-950 with trail
      ctx.fillRect(0, 0, width, height);

      // Draw subtle gridlines to emulate high-fidelity laboratory equipment
      ctx.strokeStyle = "rgba(39, 39, 42, 0.3)";
      ctx.lineWidth = 1;
      
      // Horizontal grid
      for (let y = 1; y < 5; y++) {
        const targetY = (height / 5) * y;
        ctx.beginPath();
        ctx.moveTo(0, targetY);
        ctx.lineTo(width, targetY);
        ctx.stroke();
      }
      // Vertical grid
      for (let x = 1; x < 9; x++) {
        const targetX = (width / 9) * x;
        ctx.beginPath();
        ctx.moveTo(targetX, 0);
        ctx.lineTo(targetX, height);
        ctx.stroke();
      }

      if (!analyserNode || !isPlaying) {
        // Render a warm ambient idling state
        ctx.beginPath();
        ctx.strokeStyle = "rgba(14, 165, 233, 0.4)"; // Sky 500
        ctx.lineWidth = 2;
        ctx.moveTo(0, height / 2);
        
        if (mode === "oscilloscope") {
          for (let i = 0; i < width; i++) {
            const y = height / 2 + Math.sin(i * 0.03 + Date.now() * 0.005) * 5;
            ctx.lineTo(i, y);
          }
        } else if (mode === "phase") {
          ctx.arc(width / 2, height / 2, 25 + Math.sin(Date.now() * 0.003) * 5, 0, Math.PI * 2);
        } else {
          // Idle ambient spectrum
          ctx.beginPath();
          for (let i = 0; i < width; i += 8) {
            const barH = 3 + Math.sin(i * 0.05 + Date.now() * 0.003) * 2;
            ctx.fillStyle = "rgba(14, 165, 233, 0.2)";
            ctx.fillRect(i, height - barH, 5, barH);
          }
        }
        ctx.stroke();
        return;
      }

      if (mode === "spectrum") {
        analyserNode.getByteFrequencyData(dataArray);

        const barWidth = (width / bufferLength) * 1.6;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = (dataArray[i] / 255) * (height * 0.85);

          // Track peaks with decay
          if (barHeight > peaks[i]) {
            peaks[i] = barHeight;
          } else {
            peaks[i] = Math.max(0, peaks[i] - 1.5); // Decay speed
          }

          // Generate vibrant gold-to-cyan audio gradient
          const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          gradient.addColorStop(0, "rgba(6, 182, 212, 0.85)"); // Cyan-500
          gradient.addColorStop(0.5, "rgba(14, 165, 233, 0.85)"); // Sky-500
          gradient.addColorStop(1, "rgba(99, 102, 241, 0.85)"); // Indigo-500

          ctx.fillStyle = gradient;
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight);

          // Draw peak indicators
          ctx.fillStyle = "rgba(192, 132, 252, 0.9)"; // Purple-400
          ctx.fillRect(x, height - peaks[i] - 2, barWidth - 1, 2);

          x += barWidth;
          if (x >= width) break;
        }
      } 
      else if (mode === "oscilloscope") {
        analyserNode.getByteTimeDomainData(dataArray);

        ctx.beginPath();
        ctx.lineWidth = 2.5;
        
        // Emulate cyan vector phosphorus display glow
        ctx.strokeStyle = "rgba(34, 211, 238, 0.95)"; // Cyan-400
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(34, 211, 238, 0.6)";

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0; // Dynamic scale around center reference
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
        }

        ctx.lineTo(width, height / 2);
        ctx.stroke();
        
        // Reset shadow settings immediately to preserve rendering speeds 
        ctx.shadowBlur = 0;
      } 
      else if (mode === "phase") {
        // Simulate a phase-correlation scope by plotting consecutive samples
        analyserNode.getByteTimeDomainData(dataArray);
        
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = "rgba(139, 92, 246, 0.85)"; // Violet-500
        ctx.shadowBlur = 6;
        ctx.shadowColor = "rgba(139, 92, 246, 0.4)";

        const len = bufferLength / 2;
        const centerX = width / 2;
        const centerY = height / 2;
        const scale = Math.min(centerX, centerY) * 0.8;

        for (let i = 0; i < len; i++) {
          // Treat left channel as index i, right channel as index i+1
          const leftVal = (dataArray[i * 2] - 128) / 128;
          const rightVal = (dataArray[i * 2 + 1] - 128) / 128;

          // Project rotated 45 degrees to plot Mid vs. Side correlation
          const x = centerX + (leftVal - rightVal) * scale * 0.707;
          const y = centerY - (leftVal + rightVal) * scale * 0.707;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      resizeObserver.disconnect();
    };
  }, [analyserNode, isPlaying, mode]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-zinc-800/80 bg-zinc-950 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full block" id="audiowave_canvas" />
      {/* Scope Calibration Corner Labels */}
      <div className="absolute top-2 left-3 font-mono text-[10px] text-zinc-500 tracking-wider flex items-center gap-1.5 pointer-events-none select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
        REALTIME AUDIO ANALYZER
      </div>
      <div className="absolute top-2 right-3 font-mono text-[10px] text-zinc-500 tracking-wider pointer-events-none select-none">
        {mode === "spectrum" ? "FFT RESOLUTION: 512" : mode === "oscilloscope" ? "SWEEP TRIGGER: AUTO" : "PHASE MATRIX: L/R"}
      </div>
      <div className="absolute bottom-2 left-3 font-mono text-[9px] text-zinc-600 pointer-events-none select-none">
        Y-AXIS: AMP (dBFS)
      </div>
      <div className="absolute bottom-2 right-3 font-mono text-[9px] text-zinc-600 pointer-events-none select-none">
        X-AXIS: {mode === "spectrum" ? "FREQ (Hz)" : mode === "oscilloscope" ? "TIME (ms)" : "MID/SIDE"}
      </div>
    </div>
  );
}
