import { useEffect, useRef } from "react";

interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    baseVx: number;
    baseVy: number;
    id: number;
}

interface Pulse {
    start: Particle;
    end: Particle;
    progress: number;
    speed: number;
    color: string;
}

export const ActiveBackground = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: -1000, y: -1000 });

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const particleCount = Math.floor((width * height) / 12000); // Slightly denser
        const connectionDistance = 160;
        const interactionRadius = 250;

        let particles: Particle[] = [];
        let pulses: Pulse[] = [];

        // Track Mouse
        const handleMouseMove = (e: MouseEvent) => {
            const rect = canvas.getBoundingClientRect();
            mouseRef.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
        };
        window.addEventListener("mousemove", handleMouseMove);

        // Initialize Particles with meaningful drift
        for (let i = 0; i < particleCount; i++) {
            const vx = (Math.random() - 0.5) * 0.8; // Faster base drift
            const vy = (Math.random() - 0.5) * 0.8;
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: vx,
                vy: vy,
                baseVx: vx,
                baseVy: vy,
                id: i
            });
        }

        const animate = () => {
            if (!ctx) return;

            ctx.fillStyle = "#020202";
            ctx.fillRect(0, 0, width, height);

            particles.forEach(p => {
                // drift
                p.x += p.vx;
                p.y += p.vy;

                // Physics: Mouse Interaction (Repulsion + Connectivity)
                const dx = p.x - mouseRef.current.x;
                const dy = p.y - mouseRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < interactionRadius) {
                    // Push particles away gently to create a "hole" or space
                    const force = (interactionRadius - dist) / interactionRadius;
                    const angle = Math.atan2(dy, dx);
                    const pushX = Math.cos(angle) * force * 0.5;
                    const pushY = Math.sin(angle) * force * 0.5;

                    p.vx += pushX;
                    p.vy += pushY;

                    // Draw Line to Mouse (Interactive Web)
                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 240, 255, ${force * 0.5})`;
                    ctx.lineWidth = 1;
                    ctx.moveTo(mouseRef.current.x, mouseRef.current.y);
                    ctx.lineTo(p.x, p.y);
                    ctx.stroke();
                }

                // Friction/Return to base speed
                p.vx = p.vx * 0.98 + p.baseVx * 0.02;
                p.vy = p.vy * 0.98 + p.baseVy * 0.02;

                // Wrap-around logic (Move along website)
                if (p.x < -50) p.x = width + 50;
                if (p.x > width + 50) p.x = -50;
                if (p.y < -50) p.y = height + 50;
                if (p.y > height + 50) p.y = -50;

                // Draw Node
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
                ctx.fillStyle = "rgba(0, 240, 255, 0.8)";
                ctx.fill();
            });

            // Connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const p1 = particles[i];
                    const p2 = particles[j];

                    const dx = p1.x - p2.x;
                    const dy = p1.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    if (dist < connectionDistance) {
                        const opacity = 1 - (dist / connectionDistance);
                        ctx.beginPath();
                        ctx.strokeStyle = `rgba(139, 92, 246, ${opacity * 0.4})`;
                        ctx.lineWidth = 1;
                        ctx.moveTo(p1.x, p1.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();

                        // Pulses
                        if (Math.random() < 0.003) {
                            pulses.push({
                                start: p1,
                                end: p2,
                                progress: 0,
                                speed: 0.03 + Math.random() * 0.04,
                                color: Math.random() > 0.6 ? "#00F0FF" : "#ffffff"
                            });
                        }
                    }
                }
            }

            // Draw Pulses
            for (let i = pulses.length - 1; i >= 0; i--) {
                const p = pulses[i];
                p.progress += p.speed;
                if (p.progress >= 1) {
                    pulses.splice(i, 1);
                    continue;
                }
                const currX = p.start.x + (p.end.x - p.start.x) * p.progress;
                const currY = p.start.y + (p.end.y - p.start.y) * p.progress;

                ctx.beginPath();
                ctx.arc(currX, currY, 2.5, 0, Math.PI * 2);
                ctx.fillStyle = p.color;
                ctx.fill();
            }

            requestAnimationFrame(animate);
        };

        const handleResize = () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        };

        window.addEventListener("resize", handleResize);
        const animId = requestAnimationFrame(animate);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("mousemove", handleMouseMove);
            cancelAnimationFrame(animId);
        };
    }, []);

    return (
        <div className="fixed inset-0 w-full h-full overflow-hidden -z-50 bg-[#020202]">
            <div
                className="absolute inset-0 opacity-[0.05] pointer-events-none"
                style={{
                    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
                    backgroundSize: '100px 100px'
                }}
            />
            <canvas ref={canvasRef} className="absolute inset-0 z-[1] w-full h-full block" />
        </div>
    );
};
