import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

export const TopProgressBar = () => {
    const { pathname } = useLocation();
    const [loading, setLoading] = useState(false);

    // Trigger fake loading on route change
    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 1500); // 1.5s fake load
        return () => clearTimeout(timer);
    }, [pathname]);

    return (
        <div className="fixed top-0 left-0 right-0 z-[10000] pointer-events-none">
            {loading && (
                <motion.div
                    initial={{ width: "0%", opacity: 1 }}
                    animate={{ width: "100%", opacity: 0 }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className="h-[3px] bg-neon shadow-[0_0_15px_rgba(0,240,255,0.6)]"
                />
            )}
        </div>
    );
};
