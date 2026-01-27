import React from 'react';

interface ChartCardProps {
    title: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    headerRight?: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({ title, children, className = '', headerRight }) => {
    return (
        <div className={`glass-panel rounded-2xl p-4 shadow-xl overflow-hidden ${className}`}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                    <span className="w-1 h-6 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></span>
                    {title}
                </h3>
                {headerRight && <div>{headerRight}</div>}
            </div>
            <div className="w-full h-[300px]">
                {children}
            </div>
        </div>
    );
};
