import { motion, useInView } from "framer-motion";
import { useRef } from "react";

interface TextRevealProps {
    children: React.ReactNode;
    className?: string;
    blockColor?: string;
    delay?: number;
}

export const TextReveal = ({ children, className = "", blockColor = "#00F0FF", delay = 0 }: TextRevealProps) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-10%" });

    return (
        <div ref={ref} className={`relative inline-block overflow-hidden ${className}`}>
            {/* The Text */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.01, delay: delay + 0.25 }} // Text appears instantly mid-swipe
            >
                {children}
            </motion.div>

            {/* The Block Curtain */}
            <motion.div
                initial={{ left: 0, width: "0%" }}
                animate={isInView ? {
                    left: ["0%", "0%", "100%"],
                    width: ["0%", "100%", "0%"]
                } : {}}
                transition={{
                    duration: 0.6,
                    ease: "easeInOut",
                    times: [0, 0.5, 1],
                    delay: delay
                }}
                style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    background: blockColor,
                    zIndex: 20
                }}
            />
        </div>
    );
};
