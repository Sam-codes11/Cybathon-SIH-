import { useEffect, useRef } from "react";
import { createNoise3D } from "simplex-noise";

export const WavyBackground = ({
  children,
  className = "",
  containerClassName = "",
  colors,
  waveWidth = 50,
  backgroundFill = "#070b14",
  blur = 10,
  speed = "fast",
  waveOpacity = 0.5,
  ...props
}) => {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    if (!ctx) return;

    const noise = createNoise3D();

    let w = 0;
    let h = 0;
    let nt = 0;

    const getSpeed = () => {
      return speed === "slow" ? 0.001 : 0.002;
    };

    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;

      ctx.filter = `blur(${blur}px)`;
    };

    const waveColors = colors || [
      "#22d3ee",
      "#38bdf8",
      "#60a5fa",
      "#818cf8",
      "#a78bfa",
    ];

    const drawWave = (n) => {
      nt += getSpeed();

      for (let i = 0; i < n; i++) {
        ctx.beginPath();

        ctx.lineWidth = waveWidth;
        ctx.strokeStyle = waveColors[i % waveColors.length];

        for (let x = 0; x < w; x += 5) {
          const y = noise(x / 800, 0.3 * i, nt) * 100;

          ctx.lineTo(x, y + h * 0.5);
        }

        ctx.stroke();
        ctx.closePath();
      }
    };

    const render = () => {
      ctx.fillStyle = backgroundFill;
      ctx.globalAlpha = 1;

      ctx.fillRect(0, 0, w, h);

      ctx.globalAlpha = waveOpacity;

      drawWave(5);

      animationRef.current = requestAnimationFrame(render);
    };

    resize();

    window.addEventListener("resize", resize);

    render();

    return () => {
      window.removeEventListener("resize", resize);

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    backgroundFill,
    blur,
    colors,
    speed,
    waveOpacity,
    waveWidth,
  ]);

  return (
    <div
      className={`relative min-h-screen w-full overflow-hidden ${containerClassName}`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 h-screen w-screen"
      />

      <div
        className={`relative z-10 w-full ${className}`}
        {...props}
      >
        {children}
      </div>
    </div>
  );
};

export default WavyBackground;
