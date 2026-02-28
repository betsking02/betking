import { useRef, useEffect } from 'react';

const COLORS = {
  bg: '#0f1923',
  grid: 'rgba(42, 58, 74, 0.3)',
  gridAxis: 'rgba(42, 58, 74, 0.6)',
  trail: '#ff6b00',
  trailGlow: 'rgba(255, 107, 0, 0.3)',
  plane: '#ffffff',
  planeGlow: '#ff6b00',
  stars: 'rgba(255, 255, 255, 0.5)',
  multiplierRun: '#00e701',
  multiplierCrash: '#ff4444',
  multiplierWait: '#7a8a9e',
  explosion1: '#ff4444',
  explosion2: '#ff6b00',
  explosion3: '#ffd700',
  skyTop: '#0a1628',
  skyBottom: '#1a2c38',
};

export default function AviatorCanvas({ status, multiplier, countdown }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const starsRef = useRef([]);
  const explosionRef = useRef({ particles: [], active: false, frame: 0 });
  const trailRef = useRef([]);

  // Generate stars once
  useEffect(() => {
    starsRef.current = Array.from({ length: 80 }, () => ({
      x: Math.random(),
      y: Math.random(),
      size: Math.random() * 2 + 0.5,
      twinkle: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.02 + 0.005,
    }));
  }, []);

  // Reset trail on new round
  useEffect(() => {
    if (status === 'waiting') {
      trailRef.current = [];
      explosionRef.current = { particles: [], active: false, frame: 0 };
    }
  }, [status]);

  // Trigger explosion on crash
  useEffect(() => {
    if (status === 'crashed' && !explosionRef.current.active) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const trail = trailRef.current;
      const lastPoint = trail.length > 0 ? trail[trail.length - 1] : { x: canvas.width * 0.5, y: canvas.height * 0.3 };

      const particles = [];
      for (let i = 0; i < 60; i++) {
        const angle = (Math.PI * 2 * i) / 60 + Math.random() * 0.5;
        const speed = Math.random() * 6 + 2;
        particles.push({
          x: lastPoint.x,
          y: lastPoint.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: Math.random() * 0.02 + 0.01,
          size: Math.random() * 4 + 2,
          color: [COLORS.explosion1, COLORS.explosion2, COLORS.explosion3][Math.floor(Math.random() * 3)],
        });
      }
      explosionRef.current = { particles, active: true, frame: 0 };
    }
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    let time = 0;

    const draw = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      time += 0.016;

      // Sky gradient background
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, COLORS.skyTop);
      skyGrad.addColorStop(1, COLORS.skyBottom);
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Stars
      drawStars(ctx, w, h, time);

      // Grid
      drawGrid(ctx, w, h);

      if (status === 'running' || status === 'crashed') {
        drawCurveAndPlane(ctx, w, h, time);
      }

      // Explosion
      if (explosionRef.current.active) {
        drawExplosion(ctx);
      }

      // Multiplier text
      drawMultiplier(ctx, w, h);

      // Waiting state
      if (status === 'waiting') {
        drawWaiting(ctx, w, h, time);
      }

      animRef.current = requestAnimationFrame(draw);
    };

    const drawStars = (ctx, w, h, time) => {
      for (const star of starsRef.current) {
        const alpha = 0.3 + 0.4 * Math.sin(time * star.speed * 60 + star.twinkle);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();

        // Move stars left when running (parallax effect)
        let sx = star.x * w;
        if (status === 'running') {
          sx = ((star.x * w - time * 20 * star.size) % w + w) % w;
        }

        ctx.arc(sx, star.y * h, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawGrid = (ctx, w, h) => {
      const padding = 40;
      const graphW = w - padding * 2;
      const graphH = h - padding * 2;

      ctx.strokeStyle = COLORS.grid;
      ctx.lineWidth = 0.5;

      // Horizontal lines
      for (let i = 0; i <= 4; i++) {
        const y = padding + (graphH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(w - padding, y);
        ctx.stroke();
      }

      // Vertical lines
      for (let i = 0; i <= 6; i++) {
        const x = padding + (graphW / 6) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, h - padding);
        ctx.stroke();
      }

      // Axis lines
      ctx.strokeStyle = COLORS.gridAxis;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, h - padding);
      ctx.lineTo(w - padding, h - padding);
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, h - padding);
      ctx.stroke();
    };

    const drawCurveAndPlane = (ctx, w, h, time) => {
      const padding = 40;
      const graphW = w - padding * 2;
      const graphH = h - padding * 2;

      // Calculate curve points based on multiplier
      const maxMultiplier = Math.max(multiplier * 1.3, 2);
      const progress = Math.min((multiplier - 1) / (maxMultiplier - 1), 1);

      // Build trail points
      const points = [];
      const numPoints = 100;
      for (let i = 0; i <= numPoints * progress; i++) {
        const t = i / numPoints;
        const x = padding + t * graphW;
        // Exponential curve
        const curveY = Math.pow(t, 0.6);
        const y = (h - padding) - curveY * graphH * 0.85;
        points.push({ x, y });
      }

      if (points.length < 2) return;

      // Store trail for explosion position
      trailRef.current = points;

      // Draw filled area under curve
      const areaGrad = ctx.createLinearGradient(0, h - padding, 0, padding);
      areaGrad.addColorStop(0, 'rgba(255, 107, 0, 0.0)');
      areaGrad.addColorStop(0.5, 'rgba(255, 107, 0, 0.05)');
      areaGrad.addColorStop(1, 'rgba(255, 107, 0, 0.15)');

      ctx.fillStyle = areaGrad;
      ctx.beginPath();
      ctx.moveTo(points[0].x, h - padding);
      for (const p of points) {
        ctx.lineTo(p.x, p.y);
      }
      ctx.lineTo(points[points.length - 1].x, h - padding);
      ctx.closePath();
      ctx.fill();

      // Draw curve line with glow
      ctx.shadowColor = COLORS.trailGlow;
      ctx.shadowBlur = 12;
      ctx.strokeStyle = COLORS.trail;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw airplane at the end of curve
      if (status === 'running') {
        const planePos = points[points.length - 1];
        const prevPos = points.length > 2 ? points[points.length - 3] : points[0];
        const angle = Math.atan2(prevPos.y - planePos.y, planePos.x - prevPos.x);

        drawAirplane(ctx, planePos.x, planePos.y, angle, time);
      }
    };

    const drawAirplane = (ctx, x, y, angle, time) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-angle);

      const scale = 1.2;

      // Engine glow
      const glowSize = 12 + Math.sin(time * 15) * 4;
      const engineGrad = ctx.createRadialGradient(-20 * scale, 0, 0, -20 * scale, 0, glowSize);
      engineGrad.addColorStop(0, 'rgba(255, 107, 0, 0.8)');
      engineGrad.addColorStop(0.5, 'rgba(255, 68, 0, 0.3)');
      engineGrad.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = engineGrad;
      ctx.beginPath();
      ctx.arc(-20 * scale, 0, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // Flame trail
      ctx.fillStyle = 'rgba(255, 107, 0, 0.6)';
      ctx.beginPath();
      const flameLen = 15 + Math.sin(time * 20) * 8;
      ctx.moveTo(-15 * scale, -3 * scale);
      ctx.lineTo((-15 - flameLen) * scale, 0);
      ctx.lineTo(-15 * scale, 3 * scale);
      ctx.closePath();
      ctx.fill();

      // Plane body
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = COLORS.planeGlow;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      // Fuselage
      ctx.moveTo(18 * scale, 0);
      ctx.lineTo(8 * scale, -4 * scale);
      ctx.lineTo(-12 * scale, -3 * scale);
      ctx.lineTo(-15 * scale, 0);
      ctx.lineTo(-12 * scale, 3 * scale);
      ctx.lineTo(8 * scale, 4 * scale);
      ctx.closePath();
      ctx.fill();

      // Wings
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.moveTo(4 * scale, -3 * scale);
      ctx.lineTo(-2 * scale, -14 * scale);
      ctx.lineTo(-8 * scale, -14 * scale);
      ctx.lineTo(-4 * scale, -3 * scale);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(4 * scale, 3 * scale);
      ctx.lineTo(-2 * scale, 14 * scale);
      ctx.lineTo(-8 * scale, 14 * scale);
      ctx.lineTo(-4 * scale, 3 * scale);
      ctx.closePath();
      ctx.fill();

      // Tail
      ctx.fillStyle = '#ff6b00';
      ctx.beginPath();
      ctx.moveTo(-12 * scale, -3 * scale);
      ctx.lineTo(-16 * scale, -9 * scale);
      ctx.lineTo(-18 * scale, -8 * scale);
      ctx.lineTo(-15 * scale, -2 * scale);
      ctx.closePath();
      ctx.fill();

      // Cockpit window
      ctx.fillStyle = '#1da1f2';
      ctx.beginPath();
      ctx.ellipse(10 * scale, -1 * scale, 4 * scale, 2.5 * scale, -0.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    };

    const drawExplosion = (ctx) => {
      const exp = explosionRef.current;
      exp.frame++;

      for (const p of exp.particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.1; // gravity
        p.vx *= 0.98;
        p.life -= p.decay;

        if (p.life > 0) {
          ctx.globalAlpha = p.life;
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Flash effect in first few frames
      if (exp.frame < 5) {
        ctx.globalAlpha = (5 - exp.frame) / 5 * 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Deactivate when all particles dead
      if (exp.particles.every(p => p.life <= 0)) {
        exp.active = false;
      }
    };

    const drawMultiplier = (ctx, w, h) => {
      const text = `${multiplier.toFixed(2)}x`;
      let color, fontSize;

      if (status === 'crashed') {
        color = COLORS.multiplierCrash;
        fontSize = 48;
      } else if (status === 'running') {
        color = COLORS.multiplierRun;
        fontSize = 56;
      } else {
        color = COLORS.multiplierWait;
        fontSize = 40;
      }

      ctx.font = `900 ${fontSize}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Text shadow/glow
      if (status === 'running') {
        ctx.shadowColor = 'rgba(0, 231, 1, 0.5)';
        ctx.shadowBlur = 20;
      } else if (status === 'crashed') {
        ctx.shadowColor = 'rgba(255, 68, 68, 0.5)';
        ctx.shadowBlur = 20;
      }

      ctx.fillStyle = color;

      if (status === 'waiting') {
        ctx.fillText(text, w / 2, h / 2 - 20);
        // Show "WAITING" below
        ctx.font = '600 16px "Inter", sans-serif';
        ctx.fillStyle = COLORS.multiplierWait;
        ctx.shadowBlur = 0;
        ctx.fillText(`Starting in ${countdown}s...`, w / 2, h / 2 + 20);
      } else {
        ctx.fillText(text, w / 2, h * 0.3);

        if (status === 'crashed') {
          ctx.font = '800 24px "Inter", sans-serif';
          ctx.fillStyle = COLORS.multiplierCrash;
          ctx.shadowBlur = 0;
          ctx.fillText('CRASHED!', w / 2, h * 0.3 + 40);
        }
      }

      ctx.shadowBlur = 0;
    };

    const drawWaiting = (ctx, w, h, time) => {
      // Pulsing airplane icon in center
      const pulse = 0.9 + Math.sin(time * 3) * 0.1;
      ctx.save();
      ctx.translate(w / 2, h / 2 + 50);
      ctx.scale(pulse, pulse);
      ctx.font = '48px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✈️', 0, 0);
      ctx.restore();
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [status, multiplier, countdown]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        borderRadius: 'var(--radius-lg)',
      }}
    />
  );
}
