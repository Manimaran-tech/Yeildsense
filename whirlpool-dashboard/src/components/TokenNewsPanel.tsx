import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { TrendingUp, TrendingDown, Minus, Loader2, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import { mlApi } from '../api';
import { mapPoolTokens } from '../utils/tokenMapping';

interface TokenNewsPanelProps {
    tokenA: string;
    tokenB: string;
    isOpen: boolean;
}

interface HeadlineItem {
    headline: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    score: number;
}

interface NewsData {
    trend: 'bullish' | 'bearish' | 'neutral';
    net_sentiment: number;
    confidence: number;
    headlines: HeadlineItem[];
}

const SentimentIcon: FC<{ sentiment: string }> = ({ sentiment }) => {
    switch (sentiment) {
        case 'positive':
            return <TrendingUp size={14} className="text-green-400" />;
        case 'negative':
            return <TrendingDown size={14} className="text-red-400" />;
        default:
            return <Minus size={14} className="text-yellow-400" />;
    }
};

export const TokenNewsPanel: FC<TokenNewsPanelProps> = ({ tokenA, tokenB, isOpen }) => {
    const [loading, setLoading] = useState(true);
    const [newsA, setNewsA] = useState<NewsData | null>(null);
    const [newsB, setNewsB] = useState<NewsData | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        const fetchNews = async () => {
            setLoading(true);
            setError(null);

            try {
                const mapping = mapPoolTokens(tokenA, tokenB);

                // Fetch news for both tokens in parallel
                const [resultA, resultB] = await Promise.all([
                    mapping.mlTokenA ? mlApi.getTokenNews(mapping.mlTokenA) : null,
                    mapping.mlTokenB ? mlApi.getTokenNews(mapping.mlTokenB) : null
                ]);

                if (resultA?.success) {
                    setNewsA({
                        trend: resultA.sentiment.trend,
                        net_sentiment: resultA.sentiment.net_sentiment,
                        confidence: resultA.sentiment.confidence,
                        headlines: resultA.sentiment.headlines || []
                    });
                }

                if (resultB?.success) {
                    setNewsB({
                        trend: resultB.sentiment.trend,
                        net_sentiment: resultB.sentiment.net_sentiment,
                        confidence: resultB.sentiment.confidence,
                        headlines: resultB.sentiment.headlines || []
                    });
                }
            } catch (e) {
                console.error('News fetch error:', e);
                setError('Could not load news');
            } finally {
                setLoading(false);
            }
        };

        fetchNews();
    }, [isOpen, tokenA, tokenB]);

    if (!isOpen) return null;

    const getTrendColor = (trend: string) => {
        switch (trend) {
            case 'bullish': return 'text-green-400 bg-green-500/20';
            case 'bearish': return 'text-red-400 bg-red-500/20';
            default: return 'text-yellow-400 bg-yellow-500/20';
        }
    };

    const renderNewsSection = (token: string, news: NewsData | null) => {
        if (!news) {
            return (
                <div className="text-xs text-muted-foreground text-center py-4 bg-white/5 rounded-xl border border-white/5">
                    No active news feed for {token}
                </div>
            );
        }

        return (
            <div className="space-y-3">
                {/* Token Header with Trend */}
                <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-widest text-white">{token} Market</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${getTrendColor(news.trend)}`}>
                        {news.trend}
                    </span>
                </div>

                {/* Headlines */}
                {news.headlines.length > 0 ? (
                    <div className="space-y-2">
                        {news.headlines.slice(0, 3).map((item, idx) => (
                            <div
                                key={idx}
                                className="flex items-start gap-2.5 p-2 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="mt-1 flex-shrink-0"><SentimentIcon sentiment={item.sentiment} /></div>
                                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed flex-1">
                                    {item.headline}
                                </p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-slate-500 text-center py-4 bg-white/5 rounded-xl italic">
                        No recent market headlines
                    </div>
                )}

                {/* Sentiment Score */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/5">
                    <span className="uppercase font-bold tracking-widest text-[9px]">Composite Sentiment</span>
                    <span className={`font-mono font-bold ${news.net_sentiment > 0 ? 'text-emerald-400' : news.net_sentiment < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {news.net_sentiment > 0 ? '+' : ''}{(news.net_sentiment * 100).toFixed(1)}%
                    </span>
                </div>
            </div>
        );
    };

    return (
        <div className="relative h-full flex flex-col overflow-hidden bg-[#030712]/90 backdrop-blur-2xl border border-white/5 rounded-2xl shadow-xl group">
            {/* Obsidian 3D Background Elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* 3D Wireframe Polyhedron 1 */}
                <motion.div
                    className="absolute top-20 right-10 opacity-20"
                    animate={{
                        rotateX: [0, 360],
                        rotateZ: [0, 360],
                        y: [0, -20, 0],
                    }}
                    transition={{ duration: 22, repeat: Infinity, ease: "linear" }}
                >
                    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" className="filter drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">
                        <path d="M50 10 L90 50 L50 90 L10 50 Z" stroke="#06b6d4" strokeWidth="0.5" />
                        <path d="M50 10 L50 90 M10 50 L90 50" stroke="#06b6d4" strokeWidth="0.3" strokeDasharray="1 1" />
                    </svg>
                </motion.div>

                {/* 3D Wireframe Polyhedron 2 */}
                <motion.div
                    className="absolute bottom-40 left-10 opacity-15"
                    animate={{
                        rotateY: [0, 360],
                        rotateZ: [360, 0],
                        y: [0, 30, 0],
                    }}
                    transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
                >
                    <svg width="100" height="100" viewBox="0 0 100 100" fill="none">
                        <circle cx="50" cy="50" r="40" stroke="#3b82f6" strokeWidth="0.2" strokeDasharray="4 4" />
                        <ellipse cx="50" cy="50" rx="40" ry="15" stroke="#3b82f6" strokeWidth="0.5" />
                        <ellipse cx="50" cy="50" rx="15" ry="40" stroke="#3b82f6" strokeWidth="0.5" />
                    </svg>
                </motion.div>

                {/* Dark Glows */}
                <motion.div
                    animate={{
                        opacity: [0.1, 0.2, 0.1],
                    }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-32 -left-20 w-80 h-80 bg-cyan-900/20 rounded-full blur-[100px]"
                />
                <motion.div
                    animate={{
                        opacity: [0.1, 0.25, 0.1],
                    }}
                    transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
                    className="absolute -bottom-20 -right-20 w-96 h-96 bg-blue-900/20 rounded-full blur-[110px]"
                />
            </div>

            <div className="relative h-full flex flex-col p-5 overflow-y-auto custom-scrollbar">
                {/* Header */}
                <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3">
                    <div className="flex items-center gap-2">
                        <Activity size={14} className="text-yellow-400" />
                        <h4 className="text-[12px] font-black uppercase tracking-[0.15em] text-white">Market News</h4>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981] animate-pulse"></div>
                        <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest leading-none">Live</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <Loader2 className="animate-spin text-blue-400" size={32} />
                    </div>
                ) : error ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-red-400 bg-red-500/5 rounded-xl border border-red-500/10">
                        {error}
                    </div>
                ) : (
                    <div className="flex-1 space-y-4">
                        {/* Token A News */}
                        <div className="rounded-xl p-0.5">
                            {renderNewsSection(tokenA, newsA)}
                        </div>

                        <div className="h-px bg-white/5 mx-2" />

                        {/* Token B News */}
                        <div className="rounded-xl p-0.5">
                            {renderNewsSection(tokenB, newsB)}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="text-center text-[8px] text-slate-500 font-black uppercase tracking-widest pt-3 border-t border-white/5 mt-auto relative z-10">
                    Synthesis Engine Alpha v1.4
                </div>
            </div>
        </div>
    );
};

export default TokenNewsPanel;
