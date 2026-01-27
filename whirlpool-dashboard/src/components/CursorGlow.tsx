import React, { useEffect, useState } from 'react';

/**
 * CursorGlow - A global cursor glow effect component
 * Creates a colorful spotlight that follows the mouse cursor
 */
export const CursorGlow: React.FC = () => {
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            setMousePosition({
                x: e.clientX,
                y: e.clientY
            });
            if (!isVisible) setIsVisible(true);
        };

        const handleMouseLeave = () => {
            setIsVisible(false);
        };

        const handleMouseEnter = () => {
            setIsVisible(true);
        };

        window.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('mouseleave', handleMouseLeave);
        document.body.addEventListener('mouseenter', handleMouseEnter);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            document.body.removeEventListener('mouseleave', handleMouseLeave);
            document.body.removeEventListener('mouseenter', handleMouseEnter);
        };
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <>
            {/* Primary glow - purple/pink */}
            <div
                className="cursor-glow-global"
                style={{
                    left: mousePosition.x,
                    top: mousePosition.y,
                }}
            />
            {/* Secondary glow - cyan/blue */}
            <div
                className="cursor-glow-global-secondary"
                style={{
                    left: mousePosition.x,
                    top: mousePosition.y,
                }}
            />
        </>
    );
};

export default CursorGlow;
