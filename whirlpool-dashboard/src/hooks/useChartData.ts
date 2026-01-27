import { useState, useEffect } from 'react';
import { api } from '../api';

const SOL_USDC_POOL = "3KBZiL2g8C7tiJ32hTv5v3KM7aK9htpqTw4cTXz1HvPt"; // 64 tick spacing (Devnet)

export const useChartData = () => {
    const [priceHistory, setPriceHistory] = useState([]);
    const [liquidityData, setLiquidityData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch in parallel
                const [history, liquidity] = await Promise.all([
                    api.getMarketHistory('1'), // 1 day
                    api.getLiquidityDistribution(SOL_USDC_POOL)
                ]);

                if (history) setPriceHistory(history);
                if (liquidity?.distribution) setLiquidityData(liquidity.distribution);

            } catch (error) {
                console.error("Failed to fetch chart data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    return { priceHistory, liquidityData, loading };
};
