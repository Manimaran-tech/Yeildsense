import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeftRight, Wallet } from 'lucide-react';


export const Navbar = () => {
    const location = useLocation();
    const navLinks = [
        { path: '/dashboard', label: 'Liquidity Pool', icon: Wallet },
        { path: '/trade', label: 'Trade', icon: ArrowLeftRight },
    ];

    return (
        <nav className="sticky top-0 z-40 w-full px-6 py-4 glass-panel border-b border-white/5">
            <div className="flex items-center justify-between w-full max-w-[1920px] mx-auto">
                <div className="flex items-center gap-8">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-4 group">
                        <img src="/logo2.png" alt="YieldSense" className="h-12 w-auto object-contain mix-blend-screen" />
                        <h1 className="text-2xl font-heading font-bold bg-white text-transparent bg-clip-text tracking-wider hover:text-neon transition-colors">
                            YIELDSENSE
                        </h1>
                    </Link>

                    {/* Vertical Divider */}
                    <div className="h-6 w-[1px] bg-white/10 hidden md:block"></div>

                    {/* Nav Links */}
                    <div className="flex items-center gap-1">
                        {navLinks.map(({ path, label, icon: Icon }) => (
                            <Link
                                key={path}
                                to={path}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${location.pathname === path
                                    ? 'bg-neon/10 text-neon'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon size={18} />
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <WalletMultiButton className="!bg-neon/10 hover:!bg-neon/20 !text-neon !border-neon/50 !rounded-lg !font-bold !h-10 !px-6 !text-sm shadow-none transition-all !font-heading" />
                </div>
            </div>
        </nav>
    );
};
