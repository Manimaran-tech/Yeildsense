import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { CursorGlow } from './components/CursorGlow';
import { WalletContextProvider } from './providers/WalletContextProvider';
import { RealtimeProvider } from './context/RealtimeContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import '@solana/wallet-adapter-react-ui/styles.css';

function LoadingFallback() {
    return (
        <motion.div
            className="flex items-center justify-center p-8 min-h-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
        >
            <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 animate-spin"
                    style={{ animationDuration: '1.5s' }} />
                <div className="text-muted-foreground text-lg font-medium">Loading...</div>
            </div>
        </motion.div>
    );
}

// Page transition variants
const pageVariants = {
    initial: {
        opacity: 0,
        scale: 0.98,
        y: 20,
    },
    in: {
        opacity: 1,
        scale: 1,
        y: 0,
    },
    out: {
        opacity: 0,
        scale: 1.02,
        y: -20,
    }
};

const pageTransition = {
    type: "tween" as const,
    ease: "easeOut" as const,
    duration: 0.5
};

// Lazy load pages to prevent SDK initialization issues during import
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const TradingPage = lazy(() => import('./components/swap/TradingPage'));
const LandingPage = lazy(() => import('./components/LandingPage').then(m => ({ default: m.LandingPage })));

function AnimatedRoutes() {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={location.pathname}
                initial="initial"
                animate="in"
                exit="out"
                variants={pageVariants}
                transition={pageTransition}
                className="w-full"
            >
                <Suspense fallback={<LoadingFallback />}>
                    <Routes location={location}>
                        <Route path="/" element={<LandingPage />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/trade" element={<TradingPage />} />
                    </Routes>
                </Suspense>
            </motion.div>
        </AnimatePresence>
    );
}

import { ActiveBackground } from './components/ui/ActiveBackground';

// ... (imports)

import { TopProgressBar } from './components/ui/TopProgressBar';

function GlobalContent() {
    const location = useLocation();
    const isLandingPage = location.pathname === '/';

    return (
        <div className={`min-h-screen text-foreground font-sans antialiased selection:bg-neon/30 relative`}>
            {/* Global Animations */}
            <div className="scanline-beam"></div>
            <TopProgressBar />

            {/* New Active Background - The Living Scene */}
            <ActiveBackground />

            {/* Global Cursor Glow Effect - Kept for extra interactivity */}
            <CursorGlow />

            <div className="relative z-10">
                {!isLandingPage && <Navbar />}
                <main className={isLandingPage ? "w-full overflow-x-hidden" : "w-full px-4 py-8 pb-24"}>
                    <AnimatedRoutes />
                </main>
            </div>
        </div>
    );
}

function App() {
    console.log('App: Rendering...');

    return (
        <ErrorBoundary>
            <BrowserRouter>
                <WalletContextProvider>
                    <RealtimeProvider>
                        <GlobalContent />
                    </RealtimeProvider>
                </WalletContextProvider>
            </BrowserRouter>
        </ErrorBoundary>
    );
}

export default App;
