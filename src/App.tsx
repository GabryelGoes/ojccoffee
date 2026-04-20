import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Coffee, MapPin, ArrowRight, Instagram, Menu, X, Check, Star, Shield, Zap, Heart, ShoppingBag, User, LogOut, LayoutDashboard, Package, Users, Calendar, ExternalLink } from 'lucide-react';
import { auth, db, signInWithGoogle, logout, ensureUserProfile } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, collection, onSnapshot, query, where, addDoc, serverTimestamp, updateDoc, getDocs } from 'firebase/firestore';

// --- Context ---
const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: any | null;
  loading: boolean;
}>({ user: null, profile: null, loading: true });

const useAuth = () => useContext(AuthContext);

// --- Components ---
const Logo = ({ className = "h-12", light = false, moss = false }: { className?: string; light?: boolean; moss?: boolean }) => (
  <div className={`flex flex-col items-center justify-center ${className}`}>
    <img
      src="/logo-jccoffee.png?v=2"
      alt="Jccoffee — logo com montanhas e o nome da marca"
      className={`h-full w-auto object-contain ${light ? 'drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]' : ''} ${moss ? 'logo-tint-moss' : ''}`}
    />
  </div>
);

const Navbar = ({ cartCount, onOpenCart, onOpenLogin }: { cartCount: number; onOpenCart: () => void; onOpenLogin: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const { user, profile } = useAuth();

  useEffect(() => {
    let lastScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Keep navbar visible when menu is open (mobile UX).
      if (isOpen) {
        setIsVisible(true);
        lastScrollY = currentScrollY;
        return;
      }

      if (currentScrollY <= 20) {
        setIsVisible(true);
      } else if (currentScrollY > lastScrollY + 8) {
        setIsVisible(false);
      } else if (currentScrollY < lastScrollY - 8) {
        setIsVisible(true);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  return (
    <nav className={`fixed top-0 w-full z-50 glass-nav transition-transform duration-300 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="max-w-7xl mx-auto px-6 md:px-8 h-[4.5rem] md:h-[6rem] flex items-center justify-between">
        <a href="#home" className="hover:opacity-80 transition-opacity shrink-0">
          <Logo className="h-[7.5rem] md:h-[10.5rem]" moss />
        </a>

        <div className="hidden md:flex items-center gap-12 text-[11px] font-black uppercase tracking-[0.3em] text-coffee-brown/80">
          <a href="#home" className="hover:text-coffee-dark transition-colors">Início</a>
          <a href="#origin" className="hover:text-coffee-dark transition-colors">Origem</a>
          <a href="#products" className="hover:text-coffee-dark transition-colors">Cafés</a>
          <a href="#monte-club" className="hover:text-coffee-dark transition-colors">Monte Club</a>
          <a href="#story" className="hover:text-coffee-dark transition-colors">Nossa História</a>
        </div>

        <div className="flex items-center gap-4 md:gap-8">
          {user ? (
            <div className="flex items-center gap-4">
              {profile?.role === 'admin' && (
                <a href="#admin" className="p-2 text-coffee-accent hover:opacity-70 transition-opacity" title="Painel Admin">
                  <LayoutDashboard size={24} />
                </a>
              )}
              <button 
                onClick={logout}
                className="p-2 text-coffee-dark hover:opacity-70 transition-opacity"
                title="Sair"
              >
                <LogOut size={24} />
              </button>
              <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-coffee-brown/10 hidden sm:block" />
            </div>
          ) : (
            <button 
              onClick={onOpenLogin}
              className="p-2 text-coffee-dark hover:opacity-70 transition-opacity"
              title="Entrar"
            >
              <User size={24} />
            </button>
          )}

          <button 
            onClick={onOpenCart}
            className="relative p-2 text-coffee-dark hover:opacity-70 transition-opacity"
          >
            <ShoppingBag size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-coffee-accent text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
                {cartCount}
              </span>
            )}
          </button>

          <button className="hidden md:block btn-premium text-[10px] uppercase tracking-widest px-10 py-4">
            Assinar agora
          </button>

          <button className="md:hidden text-coffee-dark" onClick={() => setIsOpen(!isOpen)}>
            {isOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden bg-coffee-beige border-b border-coffee-brown/10 overflow-hidden"
          >
            <div className="p-12 flex flex-col gap-10 text-center">
              <a href="#home" onClick={() => setIsOpen(false)} className="text-3xl font-serif font-bold">Início</a>
              <a href="#origin" onClick={() => setIsOpen(false)} className="text-3xl font-serif font-bold">Origem</a>
              <a href="#products" onClick={() => setIsOpen(false)} className="text-3xl font-serif font-bold">Cafés</a>
              <a href="#monte-club" onClick={() => setIsOpen(false)} className="text-3xl font-serif font-bold">Monte Club</a>
              <a href="#story" onClick={() => setIsOpen(false)} className="text-3xl font-serif font-bold">Nossa História</a>
              <button className="btn-premium w-full text-xl">Comprar agora</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden bg-coffee-brown">
      {/* Rich Coffee Environment Background */}
      <div className="absolute inset-0 z-0">
        <img 
          src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=2070" 
          alt="Coffee Table Environment" 
          className="w-full h-full object-cover opacity-60 scale-105"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-coffee-dark/40 via-transparent to-coffee-dark/80" />
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <Logo className="h-48 mb-12 mx-auto" light />
          <h1 className="text-coffee-beige mb-10 tracking-tight">
            O café que carrega <br />
            <span className="italic font-light">propósito.</span>
          </h1>
          <p className="text-coffee-beige/80 text-2xl md:text-3xl max-w-3xl mx-auto mb-16 font-medium leading-relaxed">
            Direto da origem. Feito para momentos que importam.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
            <a href="#products" className="btn-premium px-16 py-6 text-xl bg-coffee-beige text-coffee-dark hover:bg-white">
              Conhecer cafés
            </a>
            <a href="#story" className="text-coffee-beige text-xl flex items-center gap-4 group font-bold tracking-tight">
              Nossa História <ArrowRight className="w-8 h-8 group-hover:translate-x-2 transition-transform" />
            </a>
          </div>
        </motion.div>
      </div>

      {/* Subtle Grain Overlay */}
      <div className="absolute inset-0 pointer-events-none grain-texture opacity-20" />
    </section>
  );
};

const Origin = () => (
  <section id="origin" className="py-48 px-8 bg-coffee-beige kraft-texture relative overflow-hidden">
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center relative z-10">
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
      >
        <h2 className="text-coffee-dark mb-12">
          Da altitude nasce o sabor. <br />
          <span className="italic font-light text-coffee-accent">Da origem vem o propósito.</span>
        </h2>
        <div className="space-y-10 text-coffee-brown/80 text-xl md:text-2xl leading-relaxed font-medium">
          <p>
            Nossos grãos são cultivados em altitudes elevadas, onde o clima e o solo criam o ambiente perfeito para cafés de pontuação superior.
          </p>
          <p>
            Cada montanha que inspira nossos nomes carrega uma história de elevação e superação, refletida na complexidade de cada xícara.
          </p>
        </div>
      </motion.div>
      
      <div className="relative">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.5 }}
          className="rounded-[3rem] overflow-hidden coffee-shadow aspect-[4/5]"
        >
          <img 
            src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=2070" 
            alt="Coffee Plantation Mountain" 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        {/* Mountain Line Overlay */}
        <svg viewBox="0 0 400 200" className="absolute -bottom-10 -left-10 w-64 h-auto text-coffee-accent opacity-40" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0,150 L100,50 L200,120 L300,30 L400,100" />
        </svg>
      </div>
    </div>
  </section>
);

const Products = () => {
  const products = [
    {
      name: "Cafarnaum",
      notes: "Chocolate, Avelã e Frutas Vermelhas",
      image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&q=80&w=2070",
      tag: "O Princípio"
    },
    {
      name: "Carmelo",
      notes: "Mel Silvestre, Floral e Notas Cítricas",
      image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=2070",
      tag: "Elevação"
    },
    {
      name: "Sinai",
      notes: "Castanhas, Amêndoas e Corpo Intenso",
      image: "https://images.unsplash.com/photo-1497933322477-911f0cbb5b53?auto=format&fit=crop&q=80&w=2070",
      tag: "A Lei"
    }
  ];

  return (
    <section id="products" className="py-48 px-8 bg-white wood-texture">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-32">
          <h2 className="text-coffee-dark mb-8">Nossas Seleções</h2>
          <p className="text-coffee-brown/60 text-2xl font-medium">Grãos especiais em embalagens Kraft que preservam a alma do café.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-20">
          {products.map((product, idx) => (
            <motion.div 
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2, duration: 1 }}
              className="group"
            >
              <div className="aspect-[3/4] overflow-hidden relative mb-12 rounded-[2rem] coffee-shadow bg-coffee-beige kraft-texture">
                <img 
                  src={product.image} 
                  alt={product.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-10 left-10 bg-coffee-dark text-coffee-beige text-[10px] font-black uppercase tracking-[0.3em] px-6 py-3 rounded-full">
                  {product.tag}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-4xl font-serif text-coffee-dark mb-4">{product.name}</h3>
                <p className="text-coffee-brown/60 text-lg italic mb-12 font-medium">{product.notes}</p>
                <button className="btn-minimal w-full text-sm uppercase tracking-widest">
                  Ver café
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const MonteClub = ({ onAddToCart }: { onAddToCart: (plan: any) => void }) => {
  const plans = [
    {
      id: 'primeiro-passo',
      name: "Primeiro Passo",
      description: "Um café por mês selecionado pelo barista.",
      price: "59,90",
      shipping: "+ frete",
      features: ["1 Café Especial", "Seleção do Barista", "Torra Fresca (máx. 1 mês)"]
    },
    {
      id: 'o-caminho',
      name: "O Caminho",
      description: "Dois cafés por mês selecionados a dedo pelo barista.",
      price: "119,90",
      shipping: "+ frete",
      features: ["2 Cafés Especiais", "Seleção Premium", "Torra Fresca (máx. 1 mês)", "Cafés diferentes todo mês"],
      popular: true
    },
    {
      id: 'as-alturas',
      name: "As Alturas",
      description: "Três cafés por mês selecionados a dedo pelo barista.",
      price: "179,90",
      shipping: "Frete Grátis",
      features: ["3 Cafés Especiais", "Seleção Exclusiva", "Torra Fresca (máx. 1 mês)", "Cafés diferentes todo mês", "Acesso antecipado a lotes"]
    }
  ];

  return (
    <section id="monte-club" className="py-12 md:py-14 lg:py-16 px-6 md:px-8 bg-coffee-beige kraft-texture relative overflow-hidden">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-6 md:mb-8 lg:mb-10">
          <span className="text-coffee-accent uppercase tracking-[0.5em] text-[11px] md:text-[12px] font-black mb-2 md:mb-3 block">Assinatura</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl text-coffee-dark mb-2 md:mb-3">Monte Club</h2>
          <p className="text-coffee-brown/60 text-base md:text-lg font-medium max-w-2xl mx-auto italic leading-snug">
            "Sua jornada de elevação através do café, entregue mensalmente na sua porta."
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5 lg:gap-6 md:items-stretch">
          {plans.map((plan, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2, duration: 1 }}
              className={`relative p-5 md:p-6 lg:p-7 rounded-2xl md:rounded-[1.75rem] border ${plan.popular ? 'bg-coffee-dark text-coffee-beige border-transparent coffee-shadow' : 'bg-white/50 border-coffee-brown/10'} flex flex-col`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-coffee-accent text-white text-[8px] md:text-[9px] font-black uppercase tracking-[0.25em] px-4 md:px-5 py-1.5 md:py-2 rounded-full whitespace-nowrap">
                  Mais Escolhido
                </div>
              )}
              
              <h3 className={`text-xl md:text-2xl font-serif mb-2 md:mb-3 leading-tight ${plan.popular ? 'text-coffee-beige' : 'text-coffee-dark'}`}>{plan.name}</h3>
              <p className={`text-sm md:text-base mb-4 md:mb-5 font-medium italic leading-snug ${plan.popular ? 'text-coffee-beige/60' : 'text-coffee-brown/60'}`}>
                {plan.description}
              </p>
              
              <div className="mb-4 md:mb-5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm md:text-base font-bold">R$</span>
                  <span className="text-3xl md:text-4xl lg:text-[2.6rem] font-serif font-bold tracking-tighter leading-none">{plan.price}</span>
                  <span className="text-[10px] md:text-xs font-medium uppercase tracking-widest opacity-60">/mês</span>
                </div>
                <p className="text-[10px] md:text-xs font-black uppercase tracking-widest mt-1.5 text-coffee-accent">{plan.shipping}</p>
              </div>

              <div className="space-y-1.5 md:space-y-2 mb-5 md:mb-6 flex-grow">
                {plan.features.map((feature, fIdx) => (
                  <div key={fIdx} className="flex items-start gap-2 md:gap-2.5">
                    <Check className={`w-3.5 h-3.5 md:w-4 md:h-4 shrink-0 mt-0.5 ${plan.popular ? 'text-coffee-accent' : 'text-coffee-dark'}`} />
                    <span className="text-[11px] md:text-xs font-medium tracking-tight leading-tight">{feature}</span>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => onAddToCart(plan)}
                className={`w-full py-3 md:py-3.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-[0.25em] transition-all ${plan.popular ? 'bg-coffee-beige text-coffee-dark hover:bg-white' : 'bg-coffee-dark text-coffee-beige hover:bg-coffee-brown'}`}
              >
                Assinar agora
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 md:mt-10 text-center">
          <p className="text-coffee-brown/40 text-xs md:text-sm font-black uppercase tracking-[0.35em] md:tracking-[0.5em]">
            Torra fresca garantida • Máximo 1 mês de torra
          </p>
        </div>
      </div>
      
      {/* Decorative Mountain Line */}
      <div className="absolute bottom-0 left-0 w-full h-64 opacity-5 pointer-events-none">
        <svg viewBox="0 0 1440 320" className="w-full h-full preserve-3d">
          <path fill="#3D2B1F" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,165.3C672,139,768,117,864,128C960,139,1056,181,1152,186.7C1248,192,1344,160,1392,144L1440,128L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>
    </section>
  );
};

const Story = () => (
  <section id="story" className="py-48 px-8 bg-coffee-dark text-coffee-beige relative overflow-hidden">
    <div className="absolute inset-0 z-0 opacity-20">
      <img 
        src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=2070" 
        alt="Coffee Heritage" 
        className="w-full h-full object-cover"
        referrerPolicy="no-referrer"
      />
    </div>
    
    <div className="max-w-4xl mx-auto text-center relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
      >
        <span className="text-coffee-accent uppercase tracking-[0.5em] text-[12px] font-black mb-12 block">Nossa Herança</span>
        <h2 className="text-coffee-beige mb-16">Uma história real de fé e resiliência.</h2>
        <div className="space-y-12 text-coffee-beige/80 text-2xl md:text-3xl leading-relaxed font-medium italic">
          <p>
            "A tradição do café corre em nossas veias desde a minha bisavó. O que começou como uma lida diária na terra transformou-se em uma paixão por excelência."
          </p>
          <p>
            Após décadas, resgatamos esse legado para criar a JCCOFFEE. Uma marca que não vende apenas grãos, mas sim momentos de conexão e propósito.
          </p>
        </div>
        <div className="mt-24 w-24 h-[2px] bg-coffee-accent mx-auto" />
      </motion.div>
    </div>
  </section>
);

const Experience = () => (
  <section className="py-48 px-8 bg-coffee-beige grain-texture">
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-32 items-center">
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1.2 }}
      >
        <h2 className="text-coffee-dark mb-12">
          Café é encontro. <br />
          É pausa. <br />
          <span className="italic font-light text-coffee-accent">É presença.</span>
        </h2>
        <p className="text-coffee-brown/70 text-2xl md:text-3xl font-medium leading-relaxed italic">
          "O café nunca foi só sobre o que está na xícara. É sobre quem está ao seu lado e as histórias que surgem a cada gole."
        </p>
      </motion.div>
      
      <div className="grid grid-cols-2 gap-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-[2.5rem] overflow-hidden coffee-shadow aspect-square"
        >
          <img 
            src="https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=1000" 
            alt="Brewing Coffee" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
          />
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="rounded-[2.5rem] overflow-hidden coffee-shadow aspect-square mt-20"
        >
          <img 
            src="https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=1000" 
            alt="People Drinking Coffee" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer" 
          />
        </motion.div>
      </div>
    </div>
  </section>
);

const CTA = () => (
  <section className="py-64 px-8 text-center bg-white wood-texture relative overflow-hidden">
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1.2 }}
      className="relative z-10"
    >
      <h2 className="text-coffee-dark mb-16">
        Leve mais do que café. <br />
        <span className="italic font-light text-coffee-accent">Leve propósito.</span>
      </h2>
      <button className="btn-premium text-xl uppercase tracking-[0.4em] px-24 py-8">
        Comprar agora
      </button>
    </motion.div>
    <div className="absolute inset-0 kraft-texture opacity-5 pointer-events-none" />
  </section>
);

const Footer = () => (
  <footer className="bg-coffee-dark text-coffee-beige py-32 px-8">
    <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
      <Logo className="h-24 mb-16" light />
      
      <div className="flex flex-wrap justify-center gap-16 mb-20 text-[12px] font-black uppercase tracking-[0.3em] text-coffee-beige/60">
        <a href="#home" className="hover:text-white transition-colors">Início</a>
        <a href="#origin" className="hover:text-white transition-colors">Origem</a>
        <a href="#products" className="hover:text-white transition-colors">Cafés</a>
        <a href="#monte-club" className="hover:text-white transition-colors">Monte Club</a>
        <a href="#story" className="hover:text-white transition-colors">História</a>
        <a href="https://instagram.com/ojccoffee" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white transition-colors">
          <Instagram size={18} /> @ojccoffee
        </a>
      </div>

      <div className="w-full max-w-2xl h-[1px] bg-white/10 mb-16" />
      
      <p className="text-white/20 text-[11px] uppercase tracking-[0.5em] font-bold">
        © 2026 JCCoffee. Semeando fé, colhendo propósito.
      </p>
    </div>
  </footer>
);

const AdminDashboard = () => {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = collection(db, 'subscriptions');
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const subsData = await Promise.all(snapshot.docs.map(async (subDoc) => {
        const sub = subDoc.data();
        const userSnap = await getDoc(doc(db, 'users', sub.userId));
        return {
          id: subDoc.id,
          ...sub,
          user: userSnap.data()
        };
      }));
      setSubscribers(subsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleDelivery = async (subId: string, currentStatus: string) => {
    const subRef = doc(db, 'subscriptions', subId);
    await updateDoc(subRef, {
      lastDeliveryStatus: currentStatus === 'shipped' ? 'pending' : 'shipped',
      lastDeliveryAt: serverTimestamp()
    });
  };

  return (
    <section id="admin" className="py-32 px-6 md:px-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-16 gap-8">
          <div>
            <h2 className="text-4xl md:text-5xl text-coffee-dark mb-4">Painel de Controle</h2>
            <p className="text-coffee-brown/60 font-medium uppercase tracking-widest text-sm">Gestão de Assinantes Monte Club</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-coffee-beige p-6 rounded-2xl border border-coffee-brown/5 text-center min-w-[140px]">
              <span className="block text-3xl font-serif font-bold text-coffee-dark">{subscribers.length}</span>
              <span className="text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Total Assinantes</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-coffee-brown/10">
                <th className="py-6 px-4 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Assinante</th>
                <th className="py-6 px-4 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Plano</th>
                <th className="py-6 px-4 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Início</th>
                <th className="py-6 px-4 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Status Pagto</th>
                <th className="py-6 px-4 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40">Envio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-coffee-brown/5">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-coffee-beige/30 transition-colors">
                  <td className="py-8 px-4">
                    <div className="flex items-center gap-4">
                      <img src={sub.user?.photoURL} alt="" className="w-10 h-10 rounded-full" />
                      <div>
                        <p className="font-serif text-lg text-coffee-dark">{sub.user?.displayName}</p>
                        <p className="text-xs text-coffee-brown/60">{sub.user?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-8 px-4">
                    <span className="text-sm font-bold uppercase tracking-widest text-coffee-accent">{sub.planId.replace('-', ' ')}</span>
                  </td>
                  <td className="py-8 px-4">
                    <span className="text-sm text-coffee-brown/60">{sub.startDate?.toDate().toLocaleDateString('pt-BR')}</span>
                  </td>
                  <td className="py-8 px-4">
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase tracking-widest rounded-full">Pago</span>
                  </td>
                  <td className="py-8 px-4">
                    <button 
                      onClick={() => toggleDelivery(sub.id, sub.lastDeliveryStatus)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${sub.lastDeliveryStatus === 'shipped' ? 'bg-coffee-dark text-coffee-beige' : 'bg-coffee-beige text-coffee-dark border border-coffee-brown/10'}`}
                    >
                      <Package size={14} />
                      {sub.lastDeliveryStatus === 'shipped' ? 'Enviado' : 'Pendente'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {subscribers.length === 0 && !loading && (
            <div className="py-20 text-center">
              <Users size={48} className="mx-auto mb-6 text-coffee-brown/10" />
              <p className="text-coffee-brown/40 font-medium italic">Nenhum assinante encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isCommitmentOpen, setIsCommitmentOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        await ensureUserProfile(u);
        const userSnap = await getDoc(doc(db, 'users', u.uid));
        setProfile(userSnap.data());
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const addToCart = (item: any) => {
    if (!user) {
      setIsLoginOpen(true);
      return;
    }
    setSelectedPlan(item);
    setIsCommitmentOpen(true);
  };

  const confirmSubscription = async () => {
    if (!selectedPlan || !user) return;
    
    // Mercado Pago Simulation
    // In a real app, you would call a backend function here to create a preference
    // and redirect the user to Mercado Pago checkout.
    
    try {
      await addDoc(collection(db, 'subscriptions'), {
        userId: user.uid,
        planId: selectedPlan.id,
        status: 'active',
        startDate: serverTimestamp(),
        cyclesCompleted: 0,
        paymentMethod: 'credit_card',
        lastDeliveryStatus: 'pending',
        commitmentMonths: 3
      });
      
      setIsCommitmentOpen(false);
      setCart(prev => [...prev, selectedPlan]);
      setIsCartOpen(true);
      alert('Assinatura realizada com sucesso! Bem-vindo ao Monte Club.');
    } catch (error) {
      console.error('Erro ao assinar:', error);
      alert('Ocorreu um erro ao processar sua assinatura.');
    }
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;
    const message = encodeURIComponent(
      `Olá JCCoffee! Gostaria de finalizar o meu pedido:\n\n` +
      cart.map(item => `- Plano Monte Club: ${item.name} (R$ ${item.price}/mês)`).join('\n') +
      `\n\nAguardo o retorno para os próximos passos!`
    );
    const whatsappNumber = "5500000000000"; 
    window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-coffee-beige">
        <Logo className="h-24 animate-pulse" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      <div className="min-h-screen">
        <Navbar 
          cartCount={cart.length} 
          onOpenCart={() => setIsCartOpen(true)} 
          onOpenLogin={() => setIsLoginOpen(true)}
        />
        
        {/* Login Modal */}
        <AnimatePresence>
          {isLoginOpen && !user && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsLoginOpen(false)}
                className="fixed inset-0 bg-coffee-dark/80 backdrop-blur-md z-[100]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 m-auto w-full max-w-md h-fit bg-coffee-beige z-[110] rounded-[3rem] p-12 text-center coffee-shadow"
              >
                <Logo className="h-20 mb-12 mx-auto" />
                <h2 className="text-3xl font-serif text-coffee-dark mb-6">Sua jornada começa aqui.</h2>
                <p className="text-coffee-brown/60 mb-12 font-medium italic">Faça login para acessar o Monte Club e gerenciar suas assinaturas.</p>
                <button 
                  onClick={() => {
                    signInWithGoogle();
                    setIsLoginOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-4 bg-white border border-coffee-brown/10 py-6 rounded-2xl text-coffee-dark font-bold hover:bg-coffee-beige transition-all"
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-6 h-6" />
                  Entrar com Google
                </button>
                <button onClick={() => setIsLoginOpen(false)} className="mt-8 text-[10px] uppercase font-black tracking-widest text-coffee-brown/40 hover:text-coffee-dark transition-colors">
                  Voltar ao site
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Commitment Confirmation Modal */}
        <AnimatePresence>
          {isCommitmentOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCommitmentOpen(false)}
                className="fixed inset-0 bg-coffee-dark/80 backdrop-blur-md z-[100]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed inset-0 m-auto w-full max-w-lg h-fit bg-coffee-beige z-[110] rounded-[3rem] p-12 text-center coffee-shadow"
              >
                <Shield className="w-16 h-16 text-coffee-accent mx-auto mb-8" />
                <h2 className="text-3xl font-serif text-coffee-dark mb-6">Compromisso Monte Club</h2>
                <div className="bg-white/50 p-8 rounded-2xl border border-coffee-brown/5 text-left mb-12">
                  <p className="text-coffee-dark font-bold mb-4 flex items-center gap-3">
                    <Check className="text-green-600" /> Permanência mínima de 3 meses
                  </p>
                  <p className="text-coffee-brown/60 text-sm leading-relaxed">
                    Para garantir a melhor experiência e torras exclusivas, nossas assinaturas possuem um ciclo mínimo de 3 meses. Após esse período, você pode cancelar a qualquer momento.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={confirmSubscription}
                    className="btn-premium w-full py-6 text-lg"
                  >
                    Confirmar e Pagar (Mercado Pago)
                  </button>
                  <button onClick={() => setIsCommitmentOpen(false)} className="text-[10px] uppercase font-black tracking-widest text-coffee-brown/40 hover:text-coffee-dark transition-colors py-4">
                    Cancelar
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Cart Drawer */}
        <AnimatePresence>
          {isCartOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCartOpen(false)}
                className="fixed inset-0 bg-coffee-dark/60 backdrop-blur-sm z-[60]"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 h-full w-full max-w-md bg-coffee-beige z-[70] shadow-2xl p-8 md:p-12 flex flex-col"
              >
                <div className="flex items-center justify-between mb-12">
                  <h2 className="text-3xl font-serif text-coffee-dark">Seu Carrinho</h2>
                  <button onClick={() => setIsCartOpen(false)} className="text-coffee-dark hover:opacity-50">
                    <X size={32} />
                  </button>
                </div>

                <div className="flex-grow overflow-y-auto space-y-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-20">
                      <ShoppingBag size={48} className="mx-auto mb-6 text-coffee-brown/20" />
                      <p className="text-coffee-brown/60 font-medium">Seu carrinho está vazio.</p>
                    </div>
                  ) : (
                    cart.map((item, idx) => (
                      <div key={idx} className="bg-white/50 p-6 rounded-2xl border border-coffee-brown/5 flex justify-between items-center">
                        <div>
                          <h4 className="font-serif text-xl text-coffee-dark">{item.name}</h4>
                          <p className="text-sm text-coffee-brown/60">Plano Monte Club</p>
                          <p className="text-coffee-accent font-bold mt-2">R$ {item.price}</p>
                        </div>
                        <button 
                          onClick={() => removeFromCart(idx)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          Remover
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {cart.length > 0 && (
                  <div className="mt-12 pt-8 border-t border-coffee-brown/10">
                    <div className="flex justify-between items-center mb-8">
                      <span className="text-lg font-bold uppercase tracking-widest text-coffee-brown/60">Total</span>
                      <span className="text-3xl font-serif font-bold text-coffee-dark">
                        R$ {cart.reduce((acc, item) => acc + parseFloat(item.price.replace(',', '.')), 0).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <button 
                      onClick={handleCheckout}
                      className="btn-premium w-full py-6 text-lg uppercase tracking-[0.3em]"
                    >
                      Finalizar no WhatsApp
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <Hero />
        <Origin />
        <Products />
        <MonteClub onAddToCart={addToCart} />
        {profile?.role === 'admin' && <AdminDashboard />}
        <Story />
        <Experience />
        <CTA />
        <Footer />
      </div>
    </AuthContext.Provider>
  );
}



