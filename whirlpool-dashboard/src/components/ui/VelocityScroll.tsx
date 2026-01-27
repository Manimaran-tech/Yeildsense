import { motion, useScroll, useVelocity, useTransform, useSpring } from "framer-motion";
import { useRef } from "react";

interface VelocityScrollProps {
    text: string;
    defaultVelocity?: number;
    className?: string;
}

const wrap = (min: number, max: number, v: number) => {
    const range_size = max - min;
    return ((((v - min) % range_size) + range_size) % range_size) + min;
};

export const VelocityScroll = ({ text, defaultVelocity = 5, className }: VelocityScrollProps) => {
    const baseX = useSpring(0, { stiffness: 1000, damping: 50 });
    const { scrollY } = useScroll();
    const scrollVelocity = useVelocity(scrollY);
    const smoothVelocity = useSpring(scrollVelocity, {
        damping: 50,
        stiffness: 400
    });
    const velocityFactor = useTransform(smoothVelocity, [0, 1000], [0, 5], {
        clamp: false
    });

    const x = useTransform(baseX, (v) => `${wrap(-20, -45, v)}%`);

    const directionFactor = useRef<number>(1);

    useTransform(smoothVelocity, (v) => {
        if (v < 0) {
            directionFactor.current = -1;
        } else if (v > 0) {
            directionFactor.current = 1;
        }
    });

    // Animation Loop
    useTransform(baseX, (v) => {
        // Manual animation frame loop equivalent would be needed for constant motion + scroll
        // but framer motion transforms are reactive.
        // To add clear constant velocity we need a useAnimationFrame hook.
        return v;
    })

    // We'll use a simpler approach for "Constant + Scroll" velocity using animation frames if needed,
    // but for now, let's use a simple marquee that reacts to scroll.

    return (
        <div className="parallax-text-container overflow-hidden whitespace-nowrap flex flex-nowrap m-0 p-0">
            <motion.div
                className={`scroller uppercase text-9xl font-black flex whitespace-nowrap gap-8 ${className}`}
                style={{ x }}
                animate={{
                    x: ["0%", "-100%"]
                }}
                transition={{
                    repeat: Infinity,
                    repeatType: 'loop',
                    duration: 10,
                    ease: "linear"
                }}
            >
                <span>{text} </span>
                <span>{text} </span>
                <span>{text} </span>
                <span>{text} </span>
            </motion.div>
        </div>
    );
};
// Simplified version that just scrolls
export const SimpleMarquee = ({ text, className = "" }: { text: string, className?: string }) => {
    return (
        <div className="overflow-hidden whitespace-nowrap w-full py-4 bg-black/50 backdrop-blur-sm border-y border-white/10">
            <motion.div
                className={`flex gap-12 items-center ${className}`}
                animate={{ x: ["0%", "-50%"] }}
                transition={{
                    duration: 15,
                    repeat: Infinity,
                    ease: "linear",
                }}
            >
                {Array(6).fill(text).map((t, i) => (
                    <span key={i} className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-neon/10 via-white/10 to-neon/10 tracking-tighter">
                        {t} <span className="text-neon mx-4">//</span>
                    </span>
                ))}
            </motion.div>
        </div>
    );
};
