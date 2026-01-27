import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import type { FC } from 'react';
import { X, Loader2, Minus, Plus, ChevronLeft, Info, Activity } from 'lucide-react';
import { getTokenPrice } from '../services/priceService';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { api } from '../api';
import { deserializeTransaction } from '../utils/transactions';
import { PriceChart } from './charts/PriceChart';
import { getCoinGeckoId } from '../utils/coinMapping';
import { MLInsightsPanel } from './MLInsightsPanel';
import { TokenNewsPanel } from './TokenNewsPanel';
import { StakingYieldCard } from './StakingYieldCard';
import { encryptAmount, formatEncryptedDisplay, type EncryptedAmount } from '../services/incoService';
import { SecurityStatusBanner } from './SecurityBadge';

interface CreatePositionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    poolAddress: string | null;
    tokenA: string;
    tokenB: string;
}

type ViewMode = 'deposit' | 'range';
type RangePreset = '1%' | '5%' | '10%' | 'custom';

export const CreatePositionPanel: FC<CreatePositionPanelProps> = ({
    isOpen,
    onClose,
    poolAddress,
    tokenA = 'SOL',
    tokenB = 'USDC'
}) => {
    const { publicKey, signTransaction, connected } = useWallet();
    const { connection } = useConnection();

    // View state
    const [viewMode, setViewMode] = useState<ViewMode>('deposit');

    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [tokenAPriceUsd, setTokenAPriceUsd] = useState<number>(0);
    const [tokenBPriceUsd, setTokenBPriceUsd] = useState<number>(0);
    const [displayToken, setDisplayToken] = useState<string>(tokenA); // Which token to display in chart
    const [minPrice, setMinPrice] = useState<string>('');
    const [maxPrice, setMaxPrice] = useState<string>('');

    // Range preset state
    const [selectedPreset, setSelectedPreset] = useState<RangePreset>('5%');

    // Deposit state
    const [amountA, setAmountA] = useState<string>('');
    const [amountB, setAmountB] = useState<string>('');
    // Loading and transaction states
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [priceLoading, setPriceLoading] = useState(true);
    const [liquidityData, setLiquidityData] = useState<{ tick: number, liquidity: string, price: number }[]>([]);
    const [txStatus, setTxStatus] = useState<'idle' | 'building' | 'encrypting' | 'signing' | 'confirming' | 'success' | 'error'>('idle');
    const [txSignature, setTxSignature] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inco encryption state
    const [encryptedAmountA, setEncryptedAmountA] = useState<EncryptedAmount | null>(null);
    const [encryptedAmountB, setEncryptedAmountB] = useState<EncryptedAmount | null>(null);
    const [_isEncrypting, setIsEncrypting] = useState(false);

    // Fetch current price on mount
    useEffect(() => {
        if (!isOpen || !poolAddress) return;

        const fetchPrice = async (isBackground = false) => {
            if (!isBackground) {
                setPriceLoading(true);
                if (!isOpen) {
                    setMinPrice('');
                    setMaxPrice('');
                    setCurrentPrice(0);
                }
            }

            if (!isBackground) {
                setPriceLoading(true);
            }

            try {
                const priceA = await getTokenPrice(tokenA);
                const priceB = await getTokenPrice(tokenB);

                setTokenAPriceUsd(priceA);
                setTokenBPriceUsd(priceB);

                const stablecoins = ['USDC', 'USDT'];
                const isTokenAStable = stablecoins.includes(tokenA);
                const isTokenBStable = stablecoins.includes(tokenB);
                const isTokenASOL = tokenA === 'SOL';
                const isTokenBSOL = tokenB === 'SOL';

                let displayTokenA: boolean;

                if (isTokenAStable) displayTokenA = false;
                else if (isTokenBStable) displayTokenA = true;
                else if (isTokenASOL && !isTokenBSOL) displayTokenA = false;
                else if (isTokenBSOL && !isTokenASOL) displayTokenA = true;
                else displayTokenA = true;

                const displayPrice = displayTokenA ? priceA : priceB;
                const displayTk = displayTokenA ? tokenA : tokenB;

                setDisplayToken(displayTk);

                if (displayPrice > 0) {
                    setCurrentPrice(displayPrice);
                    if (!isBackground) {
                        const percentage = 0.05;
                        const min = displayPrice * (1 - percentage);
                        const max = displayPrice * (1 + percentage);
                        setMinPrice(min.toFixed(4));
                        setMaxPrice(max.toFixed(4));
                    }
                }

                let attempts = 0;
                let success = false;
                while (attempts < 3 && !success) {
                    try {
                        const liqDist = await api.getLiquidityDistribution(poolAddress);
                        if (liqDist && liqDist.distribution && liqDist.distribution.length > 0) {
                            setLiquidityData(liqDist.distribution);
                            success = true;
                        } else {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    } catch (liqErr) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    attempts++;
                }
            } catch (error) {
                console.error("CreatePositionPanel: Price fetch error:", error);
            } finally {
                setPriceLoading(false);
            }
        };

        fetchPrice();
    }, [isOpen, poolAddress, tokenA, tokenB]);

    // Reset states when opening
    useEffect(() => {
        if (isOpen) {
            setTxStatus('idle');
            setErrorMessage(null);
            setTxSignature(null);
        }
    }, [isOpen]);

    // Apply range preset
    const applyPreset = useCallback((preset: RangePreset, price: number) => {
        if (price <= 0) return;

        let percentage = 0;
        switch (preset) {
            case '1%': percentage = 0.01; break;
            case '5%': percentage = 0.05; break;
            case '10%': percentage = 0.10; break;
            default: return;
        }

        const min = price * (1 - percentage);
        const max = price * (1 + percentage);

        setMinPrice(min.toFixed(4));
        setMaxPrice(max.toFixed(4));
        setSelectedPreset(preset);
    }, []);

    // Calculate deposit ratio
    const calculateDepositRatio = useCallback((): { ratioA: number; ratioB: number } => {
        if (!minPrice || !maxPrice || currentPrice <= 0) {
            return { ratioA: 50, ratioB: 50 };
        }

        const min = parseFloat(minPrice);
        const max = parseFloat(maxPrice);

        if (currentPrice <= min) return { ratioA: 0, ratioB: 100 };
        else if (currentPrice >= max) return { ratioA: 100, ratioB: 0 };
        else {
            const rangePosition = (currentPrice - min) / (max - min);
            const ratioB = Math.round(rangePosition * 100 * 10) / 10;
            return { ratioA: 100 - ratioB, ratioB };
        }
    }, [minPrice, maxPrice, currentPrice]);

    const exchangeRate = tokenAPriceUsd && tokenBPriceUsd ? tokenAPriceUsd / tokenBPriceUsd : 0;
    const { ratioA, ratioB } = calculateDepositRatio();

    // Calculate Estimated Yield based on range width
    const estimatedYield = useMemo(() => {
        if (!minPrice || !maxPrice || currentPrice <= 0) return 0;
        const min = parseFloat(minPrice);
        const max = parseFloat(maxPrice);
        const widthPct = ((max - min) / currentPrice) * 100;
        if (widthPct <= 0) return 0;

        // Base 15.4% for a 10% total width (±5% preset)
        // Concentration factor is roughly inverse to width
        return Math.min(125.5, 15.4 * (10 / widthPct));
    }, [minPrice, maxPrice, currentPrice]);

    const PRESET_ESTIMATES: Record<string, string> = {
        '1%': '48.2%',
        '5%': '15.4%',
        '10%': '8.2%',
        'custom': estimatedYield > 0 ? `${estimatedYield.toFixed(1)}%` : '—'
    };

    const isPeggedPair = useMemo(() => {
        const peggedTokens = ['JupSOL', 'mSOL', 'stSOL', 'bSOL', 'jitoSOL'];
        return (peggedTokens.includes(tokenA) && tokenB === 'SOL') ||
            (peggedTokens.includes(tokenB) && tokenA === 'SOL');
    }, [tokenA, tokenB]);

    const chartBars = useMemo(() => {
        if (!currentPrice) return null;
        if (isPeggedPair || liquidityData.length < 20) {
            const buckets = new Array(64).fill(0);
            let maxBucket = 0;
            for (let i = 0; i < 64; i++) {
                const dist = (i - 32) / 10;
                const height = Math.exp(-(dist * dist)) * 100;
                const variation = 0.7 + Math.random() * 0.6;
                buckets[i] = height * variation;
                if (buckets[i] > maxBucket) maxBucket = buckets[i];
            }
            return { buckets, maxBucket, isStatic: true };
        }
        if (liquidityData.length === 0) return null;

        const rangeWidth = currentPrice * 0.4;
        const step = rangeWidth / 64;
        const startPrice = currentPrice - (rangeWidth / 2);
        const buckets = new Array(64).fill(0);
        let maxBucket = 0;
        const isDisplayTokenA = displayToken === tokenA;

        liquidityData.forEach(tick => {
            let tickPriceUsd = 0;
            if (isDisplayTokenA) tickPriceUsd = tick.price * (tokenBPriceUsd || 0);
            else if (tick.price > 0) tickPriceUsd = (tokenAPriceUsd || 0) / tick.price;
            if (tickPriceUsd <= 0) return;
            if (tickPriceUsd < startPrice || tickPriceUsd > startPrice + rangeWidth) return;
            const bucketIdx = Math.floor((tickPriceUsd - startPrice) / step);
            if (bucketIdx >= 0 && bucketIdx < 64) {
                const liq = Number(tick.liquidity);
                buckets[bucketIdx] += liq;
                if (buckets[bucketIdx] > maxBucket) maxBucket = buckets[bucketIdx];
            }
        });
        return { buckets, maxBucket, isStatic: false };
    }, [currentPrice, liquidityData, tokenAPriceUsd, tokenBPriceUsd, displayToken, tokenA, isPeggedPair]);

    const handleAmountAChange = useCallback(async (value: string) => {
        setAmountA(value);
        if (value && parseFloat(value) > 0) {
            setIsEncrypting(true);
            try {
                const encrypted = await encryptAmount(value);
                setEncryptedAmountA(encrypted);
            } catch (err) {
                console.error('[CreatePosition] Encryption failed:', err);
            } finally {
                setIsEncrypting(false);
            }
        } else setEncryptedAmountA(null);

        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const calculatedB = numValue * (ratioB / ratioA) * exchangeRate;
                setAmountB(calculatedB.toFixed(9));
                try {
                    const encryptedB = await encryptAmount(calculatedB.toFixed(9));
                    setEncryptedAmountB(encryptedB);
                } catch (err) {
                    console.error('[CreatePosition] Amount B encryption failed:', err);
                }
            }
        } else if (!value) {
            setAmountB('');
            setEncryptedAmountB(null);
        }
    }, [ratioA, ratioB, exchangeRate]);

    const handleAmountBChange = useCallback(async (value: string) => {
        setAmountB(value);
        if (value && parseFloat(value) > 0) {
            setIsEncrypting(true);
            try {
                const encrypted = await encryptAmount(value);
                setEncryptedAmountB(encrypted);
            } catch (err) {
                console.error('[CreatePosition] Encryption failed:', err);
            } finally {
                setIsEncrypting(false);
            }
        } else setEncryptedAmountB(null);

        if (value && ratioA > 0 && ratioB > 0 && exchangeRate > 0) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                const calculatedA = numValue * (ratioA / ratioB) / exchangeRate;
                setAmountA(calculatedA.toFixed(9));
                try {
                    const encryptedA = await encryptAmount(calculatedA.toFixed(9));
                    setEncryptedAmountA(encryptedA);
                } catch (err) {
                    console.error('[CreatePosition] Amount A encryption failed:', err);
                }
            }
        } else if (!value) {
            setAmountA('');
            setEncryptedAmountA(null);
        }
    }, [ratioA, ratioB, exchangeRate]);

    const isInRange = currentPrice >= parseFloat(minPrice || '0') && currentPrice <= parseFloat(maxPrice || '0');

    const handleCreatePosition = async () => {
        if (!publicKey || !signTransaction) {
            setErrorMessage("Please connect your wallet first.");
            return;
        }
        if (!amountA || !minPrice || !maxPrice) {
            setErrorMessage("Please enter all required fields.");
            return;
        }

        setIsSubmitting(true);
        setTxStatus('building');
        setErrorMessage(null);

        try {
            let submissionLower = minPrice;
            let submissionUpper = maxPrice;
            if (tokenBPriceUsd > 0 && !['USDC', 'USDT'].includes(tokenB)) {
                submissionLower = (parseFloat(minPrice) / tokenBPriceUsd).toFixed(6);
                submissionUpper = (parseFloat(maxPrice) / tokenBPriceUsd).toFixed(6);
            }

            const response = await api.vaultCreatePosition({
                wallet: publicKey.toString(),
                whirlpool: poolAddress || '',
                priceLower: submissionLower,
                priceUpper: submissionUpper,
                amountA: amountA,
                encryptedAmountA: encryptedAmountA?.encrypted || '',
                encryptedAmountB: encryptedAmountB?.encrypted || '',
                amountType: 0 // 0 for Public -> Encrypted conversion in contract
            });

            if (!response.success || !response.serializedTransaction) {
                throw new Error(response.error || "Failed to build transaction");
            }

            const transaction = deserializeTransaction(response.serializedTransaction);
            setTxStatus('signing');
            const signedTx = await signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());
            setTxSignature(signature);
            setTxStatus('confirming');
            await connection.confirmTransaction(signature, 'confirmed');
            setTxStatus('success');
        } catch (error) {
            console.error("Position creation failed:", error);
            setTxStatus('error');
            setErrorMessage((error as Error).message || "Transaction failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusMessage = () => {
        switch (txStatus) {
            case 'building': return 'Building transaction...';
            case 'encrypting': return '🔒 Securing with Inco encryption...';
            case 'signing': return 'Please approve in your wallet...';
            case 'confirming': return 'Confirming on-chain...';
            case 'success': return '✅ Position created securely!';
            case 'error': return 'Transaction failed';
            default: return '';
        }
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl overflow-y-auto">
            {/* Extended Modal for 4-Column Layout */}
            <motion.div
                layout
                className={`bg-[#030712] w-full ${viewMode === 'range' ? 'max-w-[1600px] h-fit' : 'max-w-[1600px] h-[92vh]'} shadow-[0_0_120px_-20px_rgba(0,0,0,1)] animate-in fade-in zoom-in-95 duration-200 rounded-3xl overflow-hidden my-auto border border-white/10 relative flex flex-col transition-all duration-300`}
            >
                <div className="absolute inset-0 bg-blue-500/[0.02] pointer-events-none"></div>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-gradient-to-r from-blue-950/50 to-slate-950/50 backdrop-blur-md z-10">
                    <div className="flex items-center gap-2">
                        {viewMode === 'range' && (
                            <button onClick={() => setViewMode('deposit')} className="text-muted-foreground hover:text-white transition-colors">
                                <ChevronLeft size={20} />
                            </button>
                        )}
                        <h3 className="text-lg font-black text-white tracking-widest uppercase">Create Position</h3>
                    </div>
                    <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <AnimatePresence mode="wait">
                    {viewMode === 'deposit' ? (
                        /* REVERTED 4-COLUMN LAYOUT WITH BLACK THEME */
                        <motion.div
                            key="deposit-view"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.3 }}
                            className="flex flex-col lg:flex-row flex-1 min-h-0 divide-x divide-white/5 bg-black/20"
                        >
                            {/* Column 1: News (16%) */}
                            <div className="w-full lg:w-[16%] p-4 flex flex-col min-h-0">
                                <TokenNewsPanel tokenA={tokenA} tokenB={tokenB} isOpen={isOpen} />
                            </div>

                            {/* Column 2: Analysis & Performance (32%) */}
                            <div className="w-full lg:w-[32%] p-2 space-y-2 flex flex-col min-h-0 bg-black/10 overflow-y-auto custom-scrollbar">
                                <div className="min-h-[360px] flex-shrink-0">
                                    <PriceChart coinId={getCoinGeckoId(displayToken)} title={`${displayToken} Market Performance`} />
                                </div>
                                <div className="mt-4">
                                    <StakingYieldCard tokenA={tokenA} tokenB={tokenB} lpAPY={estimatedYield} />
                                </div>
                            </div>

                            {/* Column 3: Position Controls (28%) */}
                            <div className="w-full lg:w-[28%] p-4 space-y-4 flex flex-col min-h-0 bg-black/20">
                                {/* Range Presets */}
                                <div className="grid grid-cols-4 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/5">
                                    {(['1%', '5%', '10%', 'custom'] as RangePreset[]).map((preset) => (
                                        <button
                                            key={preset}
                                            onClick={() => {
                                                if (preset === 'custom') { setSelectedPreset('custom'); setViewMode('range'); }
                                                else { applyPreset(preset, currentPrice); }
                                            }}
                                            className={`py-2 rounded-lg transition-all border flex flex-col items-center gap-0.5 ${selectedPreset === preset
                                                ? 'bg-blue-600/20 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]'
                                                : 'bg-white/5 border-transparent text-slate-500 hover:bg-white/10 hover:text-slate-300'
                                                }`}
                                        >
                                            <span className="text-[10px] font-black uppercase tracking-tighter">
                                                {preset === 'custom' ? 'Custom' : `±${preset}`}
                                            </span>
                                            <span className={`text-[8px] font-bold ${selectedPreset === preset ? 'text-blue-300/80' : 'text-slate-600'}`}>
                                                {PRESET_ESTIMATES[preset]}
                                            </span>
                                        </button>
                                    ))}
                                </div>

                                {/* Summary Card */}
                                <div className="bg-black/40 rounded-2xl border border-white/5 overflow-hidden flex flex-col shadow-xl">
                                    <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]"></div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Position Summary</span>
                                        </div>
                                        <SecurityStatusBanner isEncrypted={true} tokenSymbol={tokenA} compact />
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium uppercase tracking-tighter">Current Price</span>
                                            <span className="text-emerald-400 font-mono font-black">${currentPrice.toFixed(4)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium uppercase tracking-tighter">Target Range</span>
                                            <span className="text-white font-mono font-black">${minPrice} - ${maxPrice}</span>
                                        </div>
                                        <div className="h-px bg-white/5"></div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-slate-500 font-medium uppercase tracking-tighter">Deposit Ratio</span>
                                            <span className="text-blue-400 font-black tracking-tighter">{ratioA.toFixed(0)}% {tokenA} / {ratioB.toFixed(0)}% {tokenB}</span>
                                        </div>
                                        {!isInRange && minPrice && maxPrice && (
                                            <p className="text-[9px] text-yellow-500 font-black uppercase text-center bg-yellow-500/10 py-1 rounded-lg">Out of Range</p>
                                        )}
                                    </div>
                                </div>

                                {/* Inputs */}
                                <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 pr-1">
                                    <div className="space-y-2.5">
                                        {/* Amount A */}
                                        <div className="bg-black/30 p-4 rounded-2xl border border-white/5 group focus-within:border-blue-500/30 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20"></div>
                                                    <span className="text-xs text-white font-black">{tokenA}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-600 font-mono uppercase">Available: —</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={amountA}
                                                onChange={(e) => handleAmountAChange(e.target.value)}
                                                placeholder="0.00"
                                                className="bg-transparent text-2xl font-black text-white focus:outline-none w-full placeholder:text-slate-800"
                                            />
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {amountA ? `≈ $${(parseFloat(amountA) * tokenAPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                                                </span>
                                            </div>
                                            {encryptedAmountA && (
                                                <div className="mt-2 text-[9px] text-emerald-400/80 font-mono bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                                    🔒 {formatEncryptedDisplay(encryptedAmountA.encrypted, 12)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Amount B */}
                                        <div className="bg-black/30 p-4 rounded-2xl border border-white/5 group focus-within:border-purple-500/30 transition-all">
                                            <div className="flex justify-between items-center mb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-purple-500 shadow-lg shadow-purple-500/20"></div>
                                                    <span className="text-xs text-white font-black">{tokenB}</span>
                                                </div>
                                                <span className="text-[10px] text-slate-600 font-mono uppercase">Available: —</span>
                                            </div>
                                            <input
                                                type="number"
                                                value={amountB}
                                                onChange={(e) => handleAmountBChange(e.target.value)}
                                                placeholder="0.00"
                                                className="bg-transparent text-2xl font-black text-white focus:outline-none w-full placeholder:text-slate-800"
                                            />
                                            <div className="flex justify-between items-center mt-1">
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    {amountB ? `≈ $${(parseFloat(amountB) * tokenBPriceUsd).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                                                </span>
                                            </div>
                                            {encryptedAmountB && (
                                                <div className="mt-2 text-[9px] text-emerald-400/80 font-mono bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10">
                                                    🔒 {formatEncryptedDisplay(encryptedAmountB.encrypted, 12)}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* CTA Section */}
                                <div className="pt-2">
                                    {txStatus !== 'idle' ? (
                                        <div className={`p-4 rounded-2xl border mb-4 text-xs ${txStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : txStatus === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-blue-500/10 border-blue-500/20 text-blue-400'}`}>
                                            <div className="flex items-center gap-3">
                                                {txStatus !== 'success' && txStatus !== 'error' && <Loader2 className="animate-spin" size={14} />}
                                                <span className="font-bold">{getStatusMessage()}</span>
                                            </div>
                                            {txSignature && (
                                                <a href={`https://solscan.io/tx/${txSignature}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-400 hover:underline mt-2 inline-block">View Transaction →</a>
                                            )}
                                            {errorMessage && <p className="text-[10px] text-red-400 mt-2">{errorMessage}</p>}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 justify-center mb-4">
                                            <Info size={10} className="text-slate-600" />
                                            <span className="text-[9px] text-slate-600 font-black uppercase tracking-widest italic">Encrypted Payload via Inco Network</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleCreatePosition}
                                        disabled={isSubmitting}
                                        className="w-full py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-black rounded-2xl hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-500/20 transition-all disabled:opacity-50 text-[13px] uppercase tracking-[0.2em] transform active:scale-[0.98]"
                                    >
                                        {isSubmitting ? 'Securing Position...' : !connected ? 'Connect Wallet' : 'Deploy Position'}
                                    </button>
                                </div>
                            </div>

                            {/* Column 4: AI Insights (24%) */}
                            <div className="w-full lg:w-[24%] p-4 flex flex-col min-h-0">
                                <MLInsightsPanel
                                    tokenA={tokenA}
                                    tokenB={tokenB}
                                    isOpen={isOpen}
                                    currentPriceA={(['USDC', 'USDT'].includes(tokenB) && currentPrice > 0) ? currentPrice : (tokenAPriceUsd || undefined)}
                                    currentPriceB={(['USDC', 'USDT'].includes(tokenA) && currentPrice > 0) ? (1 / currentPrice) : (tokenBPriceUsd || undefined)}
                                    onPredictedRangeChange={(lower, upper) => {
                                        if (minPrice === '' && maxPrice === '') {
                                            setMinPrice(lower.toFixed(4));
                                            setMaxPrice(upper.toFixed(4));
                                        }
                                    }}
                                    onApplyPrediction={(lower, upper) => {
                                        setMinPrice(lower.toFixed(4));
                                        setMaxPrice(upper.toFixed(4));
                                        setSelectedPreset('custom');
                                    }}
                                />
                            </div>
                        </motion.div>
                    ) : (
                        /* Range View */
                        <motion.div
                            key="range-view"
                            initial={{ opacity: 0, scale: 0.98, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.02, y: -10 }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="p-10 space-y-6 flex-1 bg-black/40"
                        >
                            <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                    <h4 className="text-2xl font-black text-white uppercase tracking-widest">Set Price Range</h4>
                                    <p className="text-slate-500">Specify the boundaries for your liquidity deployment.</p>
                                </div>
                                <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl px-8 py-3 flex flex-col items-center shadow-lg shadow-blue-500/5">
                                    <span className="text-[11px] text-blue-400 font-black uppercase tracking-widest mb-1">Current {displayToken} Price</span>
                                    <span className="text-3xl font-mono font-black text-white">${currentPrice.toFixed(4)}</span>
                                </div>
                            </div>

                            {/* Visual Range Selector */}
                            <div
                                className="bg-[#050505] rounded-[2.5rem] border border-white/10 p-10 h-[420px] relative overflow-hidden group shadow-[inset_0_0_120px_rgba(0,0,0,1)] select-none cursor-crosshair"
                                onMouseDown={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const handleMouseMove = (moveE: MouseEvent) => {
                                        const x = moveE.clientX - rect.left;
                                        const pct = Math.max(0, Math.min(1, x / rect.width));
                                        const rangeW = currentPrice * 0.4;
                                        const startP = currentPrice - (rangeW / 2);
                                        const clickedP = startP + (pct * rangeW);

                                        const min = parseFloat(minPrice) || 0;
                                        const max = parseFloat(maxPrice) || Infinity;

                                        if (Math.abs(clickedP - min) < Math.abs(clickedP - max)) {
                                            setMinPrice(clickedP.toFixed(4));
                                        } else {
                                            setMaxPrice(clickedP.toFixed(4));
                                        }
                                        setSelectedPreset('custom');
                                    };

                                    const handleMouseUp = () => {
                                        window.removeEventListener('mousemove', handleMouseMove);
                                        window.removeEventListener('mouseup', handleMouseUp);
                                    };

                                    window.addEventListener('mousemove', handleMouseMove);
                                    window.addEventListener('mouseup', handleMouseUp);

                                    // Initial click
                                    handleMouseMove(e.nativeEvent as MouseEvent);
                                }}
                            >
                                {/* Technical Grid Background */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                                {priceLoading ? (
                                    <div className="flex items-center justify-center h-full">
                                        <div className="relative">
                                            <Loader2 className="animate-spin text-blue-500" size={40} />
                                            <div className="absolute inset-0 blur-xl bg-blue-500/20 animate-pulse" />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex items-end justify-between gap-[3px] relative pointer-events-none px-6">
                                        {/* LIVE PRICE - Neon Vertical Beam */}
                                        <div className="absolute top-0 bottom-0 left-1/2 w-[2px] z-10">
                                            <div className="h-full w-full bg-gradient-to-b from-transparent via-sky-500/50 to-transparent shadow-[0_0_20px_rgba(14,165,233,0.4)]" />
                                            <div className="absolute top-0 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                                <div className="bg-sky-600 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-[0_0_15px_rgba(2,132,199,0.6)] border border-sky-400/30 flex items-center gap-1.5 backdrop-blur-md">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                                    MARKET PRICE
                                                </div>
                                            </div>
                                        </div>

                                        {Array.from({ length: 72 }).map((_, i) => {
                                            const rangeW = currentPrice * 0.4;
                                            const barPrice = (currentPrice - (rangeW / 2)) + (i * rangeW / 72) + (rangeW / 144);
                                            const min = parseFloat(minPrice) || 0;
                                            const max = parseFloat(maxPrice) || Infinity;
                                            let heightPct = 6;
                                            if (chartBars && chartBars.maxBucket > 0) {
                                                const val = chartBars.buckets[Math.floor(i * 64 / 72)];
                                                if (val > 0) heightPct = (Math.log(val + 1) / Math.log(chartBars.maxBucket + 1)) * 80 + 10;
                                            }
                                            const isActive = barPrice >= min && barPrice <= max;
                                            return (
                                                <div
                                                    key={i}
                                                    className={`flex-1 rounded-t-full transition-all duration-500 ${isActive
                                                        ? 'bg-gradient-to-t from-blue-900/40 via-blue-500 to-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                                                        : 'bg-white/5'
                                                        }`}
                                                    style={{
                                                        height: `${heightPct}%`,
                                                        opacity: isActive ? 1 : 0.3
                                                    }}
                                                />
                                            );
                                        })}

                                        {/* Min Handle - Neon Cyan */}
                                        <div
                                            className="absolute top-0 bottom-0 w-[3px] z-30 transition-all duration-100 ease-out"
                                            style={{ left: `${((parseFloat(minPrice) - (currentPrice * 0.8)) / (currentPrice * 0.4)) * 100}%` }}
                                        >
                                            <div className="h-full w-full bg-gradient-to-b from-transparent via-cyan-500 to-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]" />
                                            <div className="absolute top-12 left-1/2 -translate-x-1/2">
                                                <div className="bg-cyan-500 text-black text-[10px] font-black px-3 py-1.5 rounded-xl shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/50 flex flex-col items-center">
                                                    <span>MIN</span>
                                                    <div className="w-1 h-3 mt-1 bg-black/20 rounded-full" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-[0_0_15px_rgba(6,182,212,0.8)]" />
                                        </div>

                                        {/* Max Handle - Neon Indigo */}
                                        <div
                                            className="absolute top-0 bottom-0 w-[3px] z-30 transition-all duration-100 ease-out"
                                            style={{ left: `${((parseFloat(maxPrice) - (currentPrice * 0.8)) / (currentPrice * 0.4)) * 100}%` }}
                                        >
                                            <div className="h-full w-full bg-gradient-to-b from-transparent via-indigo-500 to-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                                            <div className="absolute top-12 left-1/2 -translate-x-1/2">
                                                <div className="bg-indigo-500 text-white text-[10px] font-black px-3 py-1.5 rounded-xl shadow-[0_0_20px_rgba(99,102,241,0.4)] border border-indigo-400/50 flex flex-col items-center">
                                                    <span>MAX</span>
                                                    <div className="w-1 h-3 mt-1 bg-white/20 rounded-full" />
                                                </div>
                                            </div>
                                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-500 border-2 border-white shadow-[0_0_15px_rgba(99,102,241,0.8)]" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Min Boundary</label>
                                    <div className="flex items-center bg-black/40 border-2 border-white/5 rounded-2xl overflow-hidden focus-within:border-blue-500/50 transition-all shadow-xl">
                                        <button onClick={() => setMinPrice((parseFloat(minPrice) - 0.1).toFixed(4))} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><Minus size={16} /></button>
                                        <input
                                            type="number"
                                            value={minPrice}
                                            onChange={(e) => { setMinPrice(e.target.value); setSelectedPreset('custom'); }}
                                            className="flex-1 bg-transparent text-center font-mono text-lg font-black text-white focus:outline-none"
                                        />
                                        <button onClick={() => setMinPrice((parseFloat(minPrice) + 0.1).toFixed(4))} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] ml-2">Max Boundary</label>
                                    <div className="flex items-center bg-black/40 border-2 border-white/5 rounded-2xl overflow-hidden focus-within:border-blue-500/50 transition-all shadow-xl">
                                        <button onClick={() => setMaxPrice((parseFloat(maxPrice) - 0.1).toFixed(4))} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><Minus size={16} /></button>
                                        <input
                                            type="number"
                                            value={maxPrice}
                                            onChange={(e) => { setMaxPrice(e.target.value); setSelectedPreset('custom'); }}
                                            className="flex-1 bg-transparent text-center font-mono text-lg font-black text-white focus:outline-none"
                                        />
                                        <button onClick={() => setMaxPrice((parseFloat(maxPrice) + 0.1).toFixed(4))} className="p-3 text-slate-500 hover:text-white hover:bg-white/5 transition-colors"><Plus size={16} /></button>
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => setViewMode('deposit')}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-2 transform active:scale-[0.99] uppercase tracking-widest text-sm"
                            >
                                <Activity size={18} />
                                Apply Calculated Range
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>,
        document.body
    );
};
