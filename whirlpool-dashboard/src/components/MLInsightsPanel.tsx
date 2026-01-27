import { useState, useEffect, useMemo, useRef } from 'react';
import type { FC } from 'react';
import { Loader2, AlertCircle, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { mlApi, type MLQuickAnalysis } from '../api';
import { mapPoolTokens, getRecommendationDisplay, getSignalDisplay, toMLToken } from '../utils/tokenMapping';

interface MLInsightsPanelProps {
    tokenA: string;
    tokenB: string;
    isOpen: boolean;
    onPredictedRangeChange?: (lower: number, upper: number) => void;
    onApplyPrediction?: (lower: number, upper: number) => void;
    currentPriceA?: number;
    currentPriceB?: number;
}

/**
 * Fear & Greed style gauge component
 */
const SafetyGauge: FC<{ score: number }> = ({ score }) => {
    // Calculate the angle for the needle (0 = -90deg, 100 = 90deg)
    const angle = (score / 100) * 180 - 90;

    // Determine the color zone
    const getZoneColor = (s: number) => {
        if (s >= 75) return { label: 'Safe', color: '#22c55e', zone: 'green' };
        if (s >= 50) return { label: 'Moderate', color: '#eab308', zone: 'yellow' };
        if (s >= 25) return { label: 'Risky', color: '#f97316', zone: 'orange' };
        return { label: 'Avoid', color: '#ef4444', zone: 'red' };
    };

    const zone = getZoneColor(score);

    return (
        <div className="relative w-full max-w-[160px] mx-auto">
            {/* Gauge Background */}
            <svg viewBox="0 0 200 110" className="w-full">
                {/* Background arc segments */}
                <defs>
                    <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="25%" stopColor="#f97316" />
                        <stop offset="50%" stopColor="#eab308" />
                        <stop offset="75%" stopColor="#22c55e" />
                        <stop offset="100%" stopColor="#16a34a" />
                    </linearGradient>
                </defs>

                {/* Gauge arc */}
                <path
                    d="M 20 100 A 80 80 0 0 1 180 100"
                    fill="none"
                    stroke="url(#gaugeGradient)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />

                {/* Tick marks */}
                {[0, 25, 50, 75, 100].map((tick) => {
                    const tickAngle = (tick / 100) * 180 - 90;
                    const rad = (tickAngle * Math.PI) / 180;
                    const x1 = 100 + 70 * Math.cos(rad);
                    const y1 = 100 + 70 * Math.sin(rad);
                    const x2 = 100 + 60 * Math.cos(rad);
                    const y2 = 100 + 60 * Math.sin(rad);
                    return (
                        <line
                            key={tick}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="#64748b"
                            strokeWidth="2"
                        />
                    );
                })}

                {/* Needle */}
                <g transform={`rotate(${angle}, 100, 100)`}>
                    <line
                        x1="100"
                        y1="100"
                        x2="100"
                        y2="35"
                        stroke={zone.color}
                        strokeWidth="3"
                        strokeLinecap="round"
                    />
                    <circle cx="100" cy="100" r="8" fill={zone.color} />
                    <circle cx="100" cy="100" r="4" fill="#1e293b" />
                </g>

                {/* Score text */}
                <text x="100" y="85" textAnchor="middle" fill="white" className="text-2xl font-bold">
                    {Math.round(score)}
                </text>
                <text x="100" y="100" textAnchor="middle" className="fill-muted-foreground text-xs">
                    /100
                </text>
            </svg>

            {/* Zone Label */}
            <div className="text-center mt-1">
                <span
                    className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full"
                    style={{ backgroundColor: `${zone.color}20`, color: zone.color }}
                >
                    {zone.label}
                </span>
            </div>
        </div>
    );
};

/**
 * Signal badge component
 */
const SignalBadge: FC<{ signal: string }> = ({ signal }) => {
    const display = getSignalDisplay(signal);

    return (
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${signal === 'BUY' ? 'bg-green-500/10 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]' :
            signal === 'HOLD' ? 'bg-yellow-500/10 border border-yellow-500/20' :
                'bg-red-500/10 border border-red-500/20'
            }`}>
            <span className={`text-xl ${display.color}`}>{display.icon}</span>
            <span className={`text-[13px] font-black uppercase tracking-widest ${display.color}`}>{display.label}</span>
        </div>
    );
};

/**
 * Price range display
 */
const PriceRangeCard: FC<{
    symbol: string;
    currentPrice: number;
    lowerBound: number;
    upperBound: number;
    safetyScore: number;
}> = ({ symbol, currentPrice, lowerBound, upperBound, safetyScore }) => {
    const rangeWidth = ((upperBound - lowerBound) / currentPrice * 100).toFixed(1);

    return (
        <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
                <span className="font-black text-[10px] uppercase text-slate-400 tracking-widest">{symbol}</span>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter ${safetyScore >= 75 ? 'bg-green-500/10 text-green-400' :
                    safetyScore >= 50 ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-red-500/10 text-red-400'
                    }`}>
                    {safetyScore.toFixed(0)} SCORE
                </span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
                Price: <span className="text-white font-bold">${currentPrice.toFixed(4)}</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="text-red-400/80">${lowerBound.toFixed(4)}</span>
                <div className="flex-1 h-1 bg-white/5 rounded-full relative overflow-hidden">
                    <div
                        className="absolute h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full"
                        style={{
                            left: '0%',
                            width: '100%',
                            opacity: 0.3
                        }}
                    />
                    <div
                        className="absolute w-1 h-full bg-white z-10"
                        style={{ left: `${Math.min(100, Math.max(0, ((currentPrice - lowerBound) / (upperBound - lowerBound)) * 100))}%` }}
                    />
                </div>
                <span className="text-green-400/80">${upperBound.toFixed(4)}</span>
            </div>
            <div className="text-[9px] text-slate-500 text-center uppercase font-black tracking-widest">
                Expected Volatility: ±{rangeWidth}%
            </div>
        </div>
    );
};


/**
 * Main ML Insights Panel Component
 */
export const MLInsightsPanel: FC<MLInsightsPanelProps> = ({
    tokenA,
    tokenB,
    isOpen,
    onPredictedRangeChange,
    onApplyPrediction,
    currentPriceA,
    currentPriceB
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [analysis, setAnalysis] = useState<MLQuickAnalysis | null>(null);

    // Track if we've already fetched for the current token pair
    const fetchedForRef = useRef<string>('');

    // Check token support and ensure alphabetical ordering for ML API
    const tokenMapping = useMemo(() => {
        const mapping = mapPoolTokens(tokenA, tokenB);
        if (mapping.mlTokenA && mapping.mlTokenB && mapping.mlTokenA > mapping.mlTokenB) {
            return {
                mlTokenA: mapping.mlTokenB,
                mlTokenB: mapping.mlTokenA,
                bothSupported: mapping.bothSupported,
                swapped: true
            };
        }
        return { ...mapping, swapped: false };
    }, [tokenA, tokenB]);

    // Reset fetchedFor when panel closes or tokens change
    useEffect(() => {
        if (!isOpen) {
            fetchedForRef.current = '';
            setAnalysis(null);
            setError(null);
        }
    }, [isOpen, tokenA, tokenB]);

    useEffect(() => {
        if (!isOpen) return;

        const fetchKey = `${tokenA}-${tokenB}`;
        if (fetchedForRef.current === fetchKey && analysis) return;

        const hasPrices = currentPriceA !== undefined || currentPriceB !== undefined;
        if (!hasPrices) {
            setLoading(true);
            return;
        }

        const fetchAnalysis = async () => {
            setLoading(true);
            setError(null);

            if (!tokenMapping.bothSupported) {
                setError(`Tokens not fully supported. Available: SOL, JUP, JUPSOL, PENGU, USDT, USDC`);
                setLoading(false);
                return;
            }

            try {
                await mlApi.healthCheck();
                const originalMLTokenA = toMLToken(tokenA);
                const originalMLTokenB = toMLToken(tokenB);

                if (!originalMLTokenA || !originalMLTokenB) {
                    throw new Error('Token mapping failed');
                }

                const mlPriceMap: Record<string, number | undefined> = {
                    [originalMLTokenA]: currentPriceA,
                    [originalMLTokenB]: currentPriceB
                };

                const priceForMLTokenA = mlPriceMap[tokenMapping.mlTokenA!];
                const priceForMLTokenB = mlPriceMap[tokenMapping.mlTokenB!];

                if (typeof priceForMLTokenA !== 'number' || typeof priceForMLTokenB !== 'number') {
                    throw new Error(`Price mapping error`);
                }

                const result = await mlApi.getQuickAnalysis(
                    tokenMapping.mlTokenA!,
                    tokenMapping.mlTokenB!,
                    priceForMLTokenA,
                    priceForMLTokenB
                );

                setAnalysis(result);
                fetchedForRef.current = `${tokenA}-${tokenB}`;

                const stablecoins = ['USDC', 'USDT'];

                // Refined priority logic match CreatePositionPanel
                let finalUseTokenA: boolean;
                const isTokenAStable = stablecoins.includes(tokenA);
                const isTokenBStable = stablecoins.includes(tokenB);
                const isTokenASOL = tokenA === 'SOL';
                const isTokenBSOL = tokenB === 'SOL';

                if (isTokenAStable) finalUseTokenA = false;
                else if (isTokenBStable) finalUseTokenA = true;
                else if (isTokenASOL && !isTokenBSOL) finalUseTokenA = false;
                else if (isTokenBSOL && !isTokenASOL) finalUseTokenA = true;
                else finalUseTokenA = true;

                const resultForInputA = tokenMapping.swapped ? result.token_b : result.token_a;
                const resultForInputB = tokenMapping.swapped ? result.token_a : result.token_b;
                const displayResult = finalUseTokenA ? resultForInputA : resultForInputB;

                if (onPredictedRangeChange && displayResult) {
                    onPredictedRangeChange(displayResult.lower_bound, displayResult.upper_bound);
                }
            } catch (err) {
                console.error('ML Analysis error:', err);
                setError('ML API not available. Start the API server at port 8000.');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalysis();
    }, [isOpen, tokenMapping, onPredictedRangeChange, currentPriceA, currentPriceB, tokenA, tokenB, analysis]);

    if (!isOpen) return null;

    if (loading) {
        return (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center space-y-3">
                <Loader2 className="animate-spin text-blue-500" size={24} />
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Synthesizing Market Data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
                <div className="flex items-start gap-3 text-red-400">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-wider">AI Analysis Offline</p>
                        <p className="text-[10px] text-slate-400 leading-tight">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!analysis) return null;

    const { token_a, token_b, overall } = analysis;
    const recDisplay = getRecommendationDisplay(overall.recommendation);

    // Correctly map API results (which might be swapped) back to Input Token A and Token B
    const resultForInputA = tokenMapping.swapped ? token_b : token_a;
    const resultForInputB = tokenMapping.swapped ? token_a : token_b;

    return (
        <div className="relative h-full flex flex-col overflow-hidden bg-[#030712]/90 backdrop-blur-2xl border border-white/5 rounded-3xl shadow-2xl group">
            {/* Obsidian 3D Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* 3D Wireframe Cube 1 */}
                <motion.div
                    className="absolute top-10 left-10 opacity-20"
                    animate={{
                        rotateX: [0, 360],
                        rotateY: [0, 360],
                        y: [0, 20, 0],
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                >
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                        <path d="M30 30 L70 30 L70 70 L30 70 Z" stroke="#06b6d4" strokeWidth="0.5" />
                        <path d="M40 40 L80 40 L80 80 L40 80 Z" stroke="#06b6d4" strokeWidth="0.5" />
                        <path d="M30 30 L40 40 M70 30 L80 40 M70 70 L80 80 M30 70 L40 80" stroke="#06b6d4" strokeWidth="0.5" />
                    </svg>
                </motion.div>

                {/* 3D Wireframe Cube 2 */}
                <motion.div
                    className="absolute bottom-20 right-10 opacity-15"
                    animate={{
                        rotateX: [360, 0],
                        rotateY: [0, 360],
                        y: [0, -30, 0],
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                >
                    <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
                        <path d="M20 50 L50 20 L80 50 L50 80 Z" stroke="#3b82f6" strokeWidth="0.5" />
                        <path d="M20 50 L50 50 L80 50" stroke="#3b82f6" strokeWidth="0.2" strokeDasharray="2 2" />
                        <path d="M50 20 L50 80" stroke="#3b82f6" strokeWidth="0.2" strokeDasharray="2 2" />
                    </svg>
                </motion.div>

                {/* Dark Glows */}
                <motion.div
                    animate={{
                        opacity: [0.1, 0.3, 0.1],
                        scale: [1, 1.2, 1],
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-20 -right-20 w-80 h-80 bg-blue-900/40 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        opacity: [0.1, 0.2, 0.1],
                        scale: [1, 1.1, 1],
                    }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                    className="absolute -bottom-20 -left-20 w-96 h-96 bg-cyan-900/30 rounded-full blur-[120px]"
                />
            </div>

            <div className="relative h-full flex flex-col p-5 space-y-4 overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <h4 className="text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-2 text-white">
                        <Activity size={16} className="text-blue-400" />
                        Market Insights
                    </h4>
                    <div className="flex items-center gap-1.5 bg-blue-500/20 px-3 py-1 rounded-full border border-blue-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_#60a5fa]"></span>
                        <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Live Analysis</span>
                    </div>
                </div>

                {/* Safety Gauge */}
                <div className="py-2">
                    <SafetyGauge score={overall.safety_score} />
                </div>

                {/* Signal Badge */}
                <div className="flex justify-center -mt-2">
                    <SignalBadge signal={overall.signal} />
                </div>

                {/* Recommendation */}
                <div className={`text-center p-3 rounded-2xl border ${recDisplay.bgColor} border-white/10 relative overflow-hidden group/card`}>
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover/card:opacity-100 transition-opacity" />
                    <p className={`text-[12px] font-black uppercase tracking-widest ${recDisplay.color} relative z-10`}>{recDisplay.label}</p>
                    <p className="text-[10px] text-slate-300 leading-relaxed mt-1 font-medium relative z-10">{overall.message}</p>
                </div>

                {/* Predicted Price Ranges */}
                <div className="space-y-4 flex-1 min-h-0">
                    <div className="flex items-center justify-between px-1">
                        <h5 className="text-[9px] font-black text-slate-500 uppercase tracking-[0.15em]">
                            Volatility Forecast
                        </h5>
                        <span className="text-[8px] text-slate-600 font-mono">7D HORIZON</span>
                    </div>
                    <div className="space-y-2">
                        <PriceRangeCard
                            symbol={resultForInputA.symbol}
                            currentPrice={resultForInputA.current_price}
                            lowerBound={resultForInputA.lower_bound}
                            upperBound={resultForInputA.upper_bound}
                            safetyScore={resultForInputA.safety_score}
                        />
                        <PriceRangeCard
                            symbol={resultForInputB.symbol}
                            currentPrice={resultForInputB.current_price}
                            lowerBound={resultForInputB.lower_bound}
                            upperBound={resultForInputB.upper_bound}
                            safetyScore={resultForInputB.safety_score}
                        />
                    </div>
                </div>

                {/* Use AI Prediction Button */}
                {onApplyPrediction && (
                    <button
                        onClick={() => {
                            const stablecoins = ['USDC', 'USDT'];
                            let useTokenA: boolean;
                            const isTokenAStable = stablecoins.includes(tokenA);
                            const isTokenBStable = stablecoins.includes(tokenB);
                            const isTokenASOL = tokenA === 'SOL';
                            const isTokenBSOL = tokenB === 'SOL';

                            if (isTokenAStable) useTokenA = false;
                            else if (isTokenBStable) useTokenA = true;
                            else if (isTokenASOL && !isTokenBSOL) useTokenA = false;
                            else if (isTokenBSOL && !isTokenASOL) useTokenA = true;
                            else useTokenA = true;

                            const displayResult = useTokenA ? resultForInputA : resultForInputB;
                            if (displayResult) {
                                onApplyPrediction(displayResult.lower_bound, displayResult.upper_bound);
                            }
                        }}
                        className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-blue-500/10 transition-all flex items-center justify-center gap-2 group"
                    >
                        <Activity size={14} className="group-hover:scale-110 transition-transform" />
                        Optimize Range with AI
                    </button>
                )}

                <div className="text-center text-[8px] text-slate-500 font-black uppercase tracking-widest pt-3 border-t border-white/5 relative z-10">
                    YieldSense AI • Performance Engine v1.0
                </div>
            </div>
        </div>
    );
};

export default MLInsightsPanel;