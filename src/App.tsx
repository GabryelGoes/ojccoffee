import React, { useState, useRef, useEffect, createContext, useContext } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import { Coffee, MapPin, ArrowRight, Instagram, Menu, X, Check, Star, Zap, Heart, ShoppingBag, User, LogOut, LayoutDashboard, Package, Users, Calendar, ExternalLink, Mail, Phone } from 'lucide-react';
import { auth, db, signInWithGoogle, signInWithEmailPassword, signUpWithEmailPassword, logout, ensureUserProfile } from './firebase';
import { onAuthStateChanged, updateProfile, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, onSnapshot, query, where, serverTimestamp, updateDoc, getDocs } from 'firebase/firestore';

/**
 * Contato do modal "Contato" no cabeçalho — altere para seus dados reais.
 * CONTACT_PHONE_E164: formato internacional para link tel: (ex: +5548999999999)
 * CONTACT_WHATSAPP_DIGITS: só dígitos com DDI 55 (ex: 5548999999999) para wa.me
 */
const CONTACT_EMAIL = 'contato@jccoffee.com.br';
const CONTACT_PHONE_LABEL = '(00) 00000-0000';
const CONTACT_PHONE_E164 = '+5500000000000';
const CONTACT_WHATSAPP_DIGITS = '5500000000000';

// --- Context ---
const AuthContext = createContext<{
  user: FirebaseUser | null;
  profile: any | null;
  loading: boolean;
}>({ user: null, profile: null, loading: true });

const useAuth = () => useContext(AuthContext);

/** Apenas dígitos */
function digitsOnly(v: string) {
  return v.replace(/\D/g, '');
}

/** Valida dígitos verificadores do CPF brasileiro */
function isValidCpf(raw: string): boolean {
  const d = digitsOnly(raw);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let mod = (sum * 10) % 11;
  if (mod >= 10) mod = 0;
  if (mod !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  mod = (sum * 10) % 11;
  if (mod >= 10) mod = 0;
  return mod === parseInt(d[10], 10);
}

function formatCpfMask(raw: string): string {
  const d = digitsOnly(raw).slice(0, 11);
  let s = '';
  for (let i = 0; i < d.length; i++) {
    if (i === 3 || i === 6) s += '.';
    if (i === 9) s += '-';
    s += d[i];
  }
  return s;
}

function formatCepMask(raw: string): string {
  const d = digitsOnly(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

// --- Components ---
const Logo = ({
  className = 'h-12',
  light = false,
  moss = false,
  premiumTint = false,
}: {
  className?: string;
  light?: boolean;
  moss?: boolean;
  /** Tom idêntico ao botão premium (`bg-coffee-dark`), só para o modal de auth */
  premiumTint?: boolean;
}) => (
  <div className={`flex flex-col items-center justify-center ${className}`}>
    {premiumTint ? (
      <div
        className="relative h-full w-fit mx-auto"
        role="img"
        aria-label="Jccoffee — logo com montanhas e o nome da marca"
      >
        <img src="/logo-jccoffee.png?v=2" alt="" className="h-full w-auto object-contain opacity-0 pointer-events-none select-none" />
        <div
          className={`absolute inset-0 bg-coffee-dark ${light ? 'drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]' : ''}`}
          style={{
            WebkitMaskImage: 'url(/logo-jccoffee.png?v=2)',
            maskImage: 'url(/logo-jccoffee.png?v=2)',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
          }}
          aria-hidden={true}
        />
      </div>
    ) : (
      <img
        src="/logo-jccoffee.png?v=2"
        alt="Jccoffee — logo com montanhas e o nome da marca"
        className={`h-full w-auto object-contain ${light ? 'drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]' : ''} ${moss ? 'logo-tint-moss' : ''}`}
      />
    )}
  </div>
);

const Navbar = ({
  cartCount,
  onOpenCart,
  onOpenLogin,
  onOpenContact,
}: {
  cartCount: number;
  onOpenCart: () => void;
  onOpenLogin: () => void;
  onOpenContact: () => void;
}) => {
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
            type="button"
            onClick={onOpenContact}
            className="flex items-center gap-2 px-2.5 md:px-3 py-2 rounded-full border border-coffee-brown/15 text-coffee-dark text-[10px] font-black uppercase tracking-widest hover:bg-white/60 transition-colors"
            title="Contato"
          >
            <Mail size={18} strokeWidth={2.25} />
            <span className="hidden md:inline">Contato</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="relative p-2 text-coffee-dark hover:opacity-70 transition-opacity"
            title="Carrinho"
          >
            <ShoppingBag size={24} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-coffee-accent text-white text-[10px] font-bold min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </button>

          <button type="button" className="md:hidden text-coffee-dark" onClick={() => setIsOpen(!isOpen)}>
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
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenContact();
                }}
                className="btn-minimal w-full text-xl py-5 border-coffee-brown/30"
              >
                Contato
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenCart();
                }}
                className="btn-premium w-full text-xl"
              >
                Ver carrinho {cartCount > 0 ? `(${cartCount})` : ''}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

const Hero = () => {
  return (
    <section
      id="home"
      className="snap-section relative min-h-[100dvh] h-[100dvh] max-h-[100dvh] flex flex-col items-center justify-center overflow-hidden bg-coffee-brown px-5 py-16 md:py-12"
    >
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&q=80&w=2070"
          alt="Coffee Table Environment"
          className="h-full w-full object-cover object-center opacity-60"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-coffee-dark/40 via-transparent to-coffee-dark/80" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl text-center min-h-0 flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          className="flex flex-col items-center max-h-[85vh]"
        >
          <Logo className="h-[clamp(6rem,22vmin,11rem)] mb-6 md:mb-8 mx-auto shrink-0 max-h-[28vh]" light />
          <h1 className="text-coffee-beige mb-4 md:mb-6 tracking-tight text-[clamp(1.75rem,6vmin,5rem)] leading-[1.05]">
            O café que carrega <br />
            <span className="italic font-light">propósito.</span>
          </h1>
          <p className="text-coffee-beige/85 max-w-3xl mx-auto mb-8 md:mb-10 font-medium leading-snug text-[clamp(1rem,2.8vmin,1.75rem)]">
            Direto da origem. Feito para momentos que importam.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 shrink-0">
            <a
              href="#products"
              className="btn-premium px-10 md:px-14 py-4 md:py-5 text-base md:text-lg bg-coffee-beige text-coffee-dark hover:bg-white whitespace-nowrap"
            >
              Conhecer cafés
            </a>
            <a
              href="#story"
              className="text-coffee-beige text-base md:text-xl flex items-center gap-3 group font-bold tracking-tight whitespace-nowrap"
            >
              Nossa História <ArrowRight className="w-6 h-6 md:w-8 md:h-8 group-hover:translate-x-2 transition-transform shrink-0" />
            </a>
          </div>
        </motion.div>
      </div>

      <div className="absolute inset-0 pointer-events-none grain-texture opacity-20" />
    </section>
  );
};

const Origin = () => (
  <section
    id="origin"
    className="snap-section relative min-h-[100dvh] max-h-none lg:max-h-[100dvh] flex flex-col justify-center overflow-x-hidden overflow-y-visible lg:overflow-hidden bg-coffee-beige kraft-texture px-5 py-10 md:py-12 lg:px-10"
  >
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 xl:gap-16 items-center relative z-10 min-h-0 flex-1">
      <motion.div
        initial={{ opacity: 0, x: -60 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="min-h-0 flex flex-col justify-center"
      >
        <h2 className="text-coffee-dark mb-5 md:mb-7 text-[clamp(1.5rem,4.5vmin,3.75rem)] leading-[1.12] font-serif font-medium tracking-tight">
          Da altitude nasce o sabor. <br />
          <span className="italic font-light text-coffee-accent">Da origem vem o propósito.</span>
        </h2>
        <div className="space-y-4 md:space-y-5 text-coffee-brown/80 text-[clamp(0.9rem,1.8vmin,1.25rem)] leading-relaxed font-medium">
          <p>
            Nossos grãos são cultivados em altitudes elevadas, onde o clima e o solo criam o ambiente perfeito para cafés de pontuação superior.
          </p>
          <p>
            Cada montanha que inspira nossos nomes carrega uma história de elevação e superação, refletida na complexidade de cada xícara.
          </p>
        </div>
      </motion.div>

      <div className="relative min-h-0 flex items-center justify-center lg:justify-end">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.2 }}
          className="relative w-full max-w-md lg:max-w-none mx-auto lg:mx-0 rounded-[2rem] lg:rounded-[2.5rem] overflow-hidden coffee-shadow aspect-[4/5] max-h-[38vh] sm:max-h-[42vh] md:max-h-[48vh] lg:max-h-[min(58vh,520px)]"
        >
          <img
            src="https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&q=80&w=2070"
            alt="Coffee Plantation Mountain"
            className="absolute inset-0 h-full w-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <svg
          viewBox="0 0 400 200"
          className="pointer-events-none absolute -bottom-6 -left-4 lg:-left-8 w-40 lg:w-52 h-auto text-coffee-accent opacity-35"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M0,150 L100,50 L200,120 L300,30 L400,100" />
        </svg>
      </div>
    </div>
  </section>
);

type SelectionProduct = {
  id: string;
  name: string;
  description: string;
  notes: string;
  price: string;
  shipping: string;
  image: string;
  tag: string;
  features: string[];
};

const Products = ({ onAddToCart }: { onAddToCart: (item: Record<string, unknown>) => void }) => {
  const [openProductId, setOpenProductId] = useState<string | null>(null);

  useEffect(() => {
    if (!openProductId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenProductId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openProductId]);

  const products: SelectionProduct[] = [
    {
      id: 'cafarnaum',
      name: 'Cafarnaum',
      description: 'Perfil doce-frutado, corpo sedoso e final elegante.',
      notes: 'Chocolate, Avelã e Frutas Vermelhas',
      price: '69,90',
      shipping: '+ frete',
      image: '/cafarnaum.png',
      tag: 'O Princípio',
      features: ['Chocolate e avelã na xícara', 'Notas de frutas vermelhas', 'Torra média · saca 250g'],
    },
    {
      id: 'carmelo',
      name: 'Carmelo',
      description: 'Floral e vibrante, com acidez cítrica refinada.',
      notes: 'Mel Silvestre, Floral e Notas Cítricas',
      price: '69,90',
      shipping: '+ frete',
      image: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=2070',
      tag: 'Elevação',
      features: ['Mel silvestre e floral', 'Acidez cítrica limpa', 'Torra média-clara · saca 250g'],
    },
    {
      id: 'sinai',
      name: 'Sinai',
      description: 'Corpo intenso, amanteigado e persistente.',
      notes: 'Castanhas, Amêndoas e Corpo Intenso',
      price: '69,90',
      shipping: '+ frete',
      image: '/monte-sinai.png',
      tag: 'A Lei',
      features: ['Castanhas e amêndoas torradas', 'Corpo encorpado', 'Torra média-escura · saca 250g'],
    },
  ];

  const activeProduct = openProductId ? products.find((p) => p.id === openProductId) ?? null : null;

  const cartPayload = (p: SelectionProduct) => ({
    kind: 'product' as const,
    id: p.id,
    name: p.name,
    price: p.price,
    shipping: p.shipping,
    notes: p.notes,
  });

  return (
    <section
      id="products"
      className="snap-section relative flex min-h-[100dvh] flex-col justify-center overflow-x-hidden overflow-y-visible bg-white wood-texture px-4 py-10 pb-12 md:px-8 md:py-12 md:pb-14"
    >
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col justify-center">
        <div className="mb-3 shrink-0 text-center md:mb-5">
          <span className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.45em] text-coffee-accent md:mb-2 md:text-[11px]">
            Loja
          </span>
          <h2 className="mb-2 font-serif text-[clamp(1.65rem,4vmin,3.25rem)] font-medium leading-tight tracking-tight text-coffee-dark">
            Nossas Seleções
          </h2>
          <p className="mx-auto max-w-xl px-2 font-medium leading-snug text-coffee-brown/65 text-[clamp(0.85rem,2vmin,1.2rem)]">
            Toque na imagem para ver perfil, preço e notas. Adicione ao carrinho direto da vitrine ou do detalhe.
          </p>
        </div>

        <div className="-mx-2 flex min-h-0 gap-4 overflow-x-auto overflow-y-visible px-2 pb-1 pt-1 snap-x snap-mandatory md:grid md:grid-cols-3 md:items-start md:gap-6 md:overflow-visible md:snap-none lg:gap-8 [&>*]:min-w-0 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-coffee-brown/25">
          {products.map((product, idx) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12, duration: 0.75 }}
              className="flex w-[min(88vw,300px)] shrink-0 snap-center flex-col gap-3 md:w-auto"
            >
              <button
                type="button"
                onClick={() => setOpenProductId(product.id)}
                className="group relative w-full overflow-hidden rounded-2xl border border-coffee-brown/[0.1] bg-coffee-beige shadow-[0_12px_36px_-14px_rgba(61,43,31,0.22)] ring-1 ring-coffee-brown/[0.04] transition-all duration-300 hover:border-coffee-brown/25 hover:shadow-[0_18px_44px_-12px_rgba(61,43,31,0.28)] focus:outline-none focus-visible:ring-2 focus-visible:ring-coffee-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                aria-label={`Abrir detalhes de ${product.name}`}
              >
                <div className="aspect-[5/6] max-h-[min(42vw,228px)] w-full overflow-hidden sm:max-h-[min(38vw,248px)] md:max-h-[min(28vh,216px)]">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.04]"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddToCart(cartPayload(product))}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-coffee-dark py-3.5 text-[10px] font-black uppercase tracking-[0.26em] text-coffee-beige shadow-md transition-all hover:bg-coffee-brown active:scale-[0.99]"
              >
                <ShoppingBag className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
                Adicionar ao carrinho
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 shrink-0 space-y-1 text-center">
          <p className="text-[10px] text-coffee-brown/45 md:text-[11px]">Frete calculado no checkout · R$ 69,90 por saca</p>
          <p className="text-[10px] text-coffee-brown/40 md:hidden">Deslize para ver os cafés</p>
        </div>
      </div>

      <AnimatePresence>
        {activeProduct && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpenProductId(null)}
              className="fixed inset-0 z-[82] bg-coffee-dark/65 backdrop-blur-sm"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="product-modal-title"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed inset-x-4 top-[max(1rem,8dvh)] z-[83] mx-auto flex max-h-[min(680px,calc(100dvh-2rem))] max-w-lg flex-col overflow-hidden rounded-[1.75rem] border border-coffee-brown/[0.12] bg-coffee-beige shadow-[0_24px_64px_-16px_rgba(61,43,31,0.35)] md:inset-x-auto md:left-1/2 md:top-1/2 md:w-full md:-translate-x-1/2 md:-translate-y-1/2"
            >
              <div className="relative shrink-0 overflow-hidden">
                <div className="aspect-[16/10] max-h-[160px] w-full sm:max-h-[176px]">
                  <img
                    src={activeProduct.image}
                    alt={activeProduct.name}
                    className="h-full w-full object-cover object-center"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="absolute left-0 top-0 h-full w-full bg-gradient-to-t from-coffee-dark/50 to-transparent" />
                <button
                  type="button"
                  onClick={() => setOpenProductId(null)}
                  className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-coffee-beige/95 text-coffee-dark shadow-md transition-colors hover:bg-white"
                  aria-label="Fechar"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </button>
                <div className="absolute bottom-4 left-5 right-16">
                  <span className="mb-1 inline-block rounded-full bg-coffee-dark/90 px-3 py-1 text-[9px] font-black uppercase tracking-[0.26em] text-coffee-beige">
                    {activeProduct.tag}
                  </span>
                  <h3 id="product-modal-title" className="font-serif text-2xl font-medium leading-tight text-white drop-shadow-md md:text-[1.65rem]">
                    {activeProduct.name}
                  </h3>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-5 md:px-6 md:pb-8 md:pt-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="min-h-[3rem] md:min-h-[3.25rem]">
                      <p className="text-sm leading-snug text-coffee-brown/75">{activeProduct.description}</p>
                    </div>
                    <p className="mt-2 text-[12px] font-medium italic leading-snug text-coffee-brown/55">{activeProduct.notes}</p>
                  </div>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-coffee-dark shadow-sm ring-1 ring-coffee-brown/[0.08]">
                    <Coffee className="h-5 w-5" strokeWidth={2} aria-hidden />
                  </div>
                </div>

                <div className="mb-6 rounded-2xl bg-white px-4 py-4 shadow-sm ring-1 ring-coffee-brown/[0.08]">
                  <div className="flex items-end justify-center gap-1">
                    <span className="pb-1 text-sm font-bold text-coffee-brown/70">R$</span>
                    <span className="font-serif text-4xl font-bold tabular-nums leading-none tracking-tight">{activeProduct.price}</span>
                    <span className="pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-coffee-brown/45">un.</span>
                  </div>
                  <p className="mt-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-coffee-accent">{activeProduct.shipping}</p>
                </div>

                <ul className="mb-6 space-y-2.5 border-t border-coffee-brown/[0.1] pt-5">
                  {activeProduct.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-coffee-dark/10 text-coffee-dark">
                        <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1 text-[13px] leading-snug text-coffee-brown/85 md:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => {
                    onAddToCart(cartPayload(activeProduct));
                    setOpenProductId(null);
                  }}
                  className="w-full rounded-2xl bg-coffee-dark py-3.5 text-[10px] font-black uppercase tracking-[0.28em] text-coffee-beige shadow-md transition-all hover:bg-coffee-brown active:scale-[0.99]"
                >
                  Adicionar ao carrinho
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
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
    <section
      id="monte-club"
      className="snap-section relative flex min-h-[100dvh] flex-col justify-center overflow-x-hidden bg-coffee-beige kraft-texture px-4 pb-12 pt-10 md:px-8 md:pb-14 md:pt-12"
    >
      <div className="absolute bottom-0 left-0 right-0 h-32 opacity-[0.06] pointer-events-none">
        <svg viewBox="0 0 1440 120" className="w-full h-full" preserveAspectRatio="none">
          <path
            fill="#3D2B1F"
            d="M0,80L48,88C96,96,192,112,288,106.7C384,101,480,75,576,69.3C672,64,768,80,864,85.3C960,91,1056,85,1152,80C1248,75,1344,69,1392,66.7L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto relative z-10 flex w-full flex-col justify-center">
        <div className="text-center mb-3 shrink-0 md:mb-5">
          <span className="text-coffee-accent uppercase tracking-[0.45em] text-[10px] md:text-[11px] font-black mb-1.5 md:mb-2 block">
            Assinatura
          </span>
          <h2 className="text-coffee-dark mb-2 text-[clamp(1.5rem,4vmin,3rem)] font-serif font-medium leading-tight tracking-tight">
            Monte Club
          </h2>
          <p className="text-coffee-brown/60 text-[clamp(0.8rem,1.8vmin,1.05rem)] font-medium max-w-xl mx-auto italic leading-snug px-2">
            Sua jornada de elevação através do café, entregue mensalmente na sua porta.
          </p>
        </div>

        <div className="-mx-2 flex min-h-0 gap-4 overflow-x-auto overflow-y-visible pb-1 pt-1 px-2 snap-x snap-mandatory md:grid md:grid-cols-3 md:items-stretch md:gap-6 md:overflow-visible md:snap-none lg:gap-8 [&>*]:min-w-0 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-coffee-brown/25">
          {plans.map((plan, idx) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.12, duration: 0.75 }}
              className={`group relative flex h-full min-h-[min(520px,82vh)] flex-col shrink-0 w-[min(88vw,320px)] snap-center rounded-[1.75rem] p-5 pt-7 md:min-h-[540px] md:w-auto md:p-6 md:pt-8 transition-all duration-300 min-w-0 ${
                plan.popular
                  ? 'z-10 bg-gradient-to-b from-coffee-dark via-coffee-dark to-coffee-green text-coffee-beige shadow-[0_24px_48px_-12px_rgba(14,55,12,0.45)] ring-2 ring-coffee-accent/35'
                  : 'bg-white border border-coffee-brown/[0.12] shadow-[0_12px_40px_-8px_rgba(61,43,31,0.12)] hover:border-coffee-brown/20 hover:shadow-[0_16px_48px_-12px_rgba(61,43,31,0.18)]'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-px left-1/2 z-20 -translate-x-1/2 -translate-y-1/2">
                  <span className="inline-block rounded-full bg-coffee-accent px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-white shadow-md md:px-4">
                    Mais escolhido
                  </span>
                </div>
              )}

              <div className="mb-4 flex items-start justify-between gap-3 md:mb-5">
                <div className="min-w-0 flex-1 text-left">
                  <h3
                    className={`font-serif text-xl md:text-2xl font-medium leading-[1.15] tracking-tight ${
                      plan.popular ? 'text-coffee-beige' : 'text-coffee-dark'
                    }`}
                  >
                    {plan.name}
                  </h3>
                  <div className="mt-1.5 min-h-[3.25rem] md:min-h-[3.5rem]">
                    <p
                      className={`text-sm leading-snug ${
                        plan.popular ? 'text-coffee-beige/70' : 'text-coffee-brown/65'
                      }`}
                    >
                      {plan.description}
                    </p>
                  </div>
                </div>
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                    plan.popular ? 'bg-white/10 text-coffee-accent' : 'bg-coffee-beige text-coffee-dark'
                  }`}
                >
                  <Coffee className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
              </div>

              <div
                className={`mb-4 rounded-2xl px-4 py-3.5 md:mb-5 md:py-4 ${
                  plan.popular ? 'bg-white/[0.08] ring-1 ring-white/10' : 'bg-coffee-beige/80 ring-1 ring-coffee-brown/[0.06]'
                }`}
              >
                <div className="flex items-end justify-center gap-1">
                  <span className={`pb-1 text-sm font-bold ${plan.popular ? 'text-coffee-beige/80' : 'text-coffee-brown/70'}`}>
                    R$
                  </span>
                  <span className="font-serif text-4xl font-bold tabular-nums tracking-tight leading-none md:text-[2.75rem]">
                    {plan.price}
                  </span>
                  <span className={`pb-1.5 text-xs font-semibold uppercase tracking-widest ${plan.popular ? 'text-coffee-beige/45' : 'text-coffee-brown/45'}`}>
                    /mês
                  </span>
                </div>
                <p
                  className={`mt-3 text-center text-[10px] font-black uppercase tracking-[0.2em] ${
                    plan.popular ? 'text-coffee-accent' : 'text-coffee-accent'
                  }`}
                >
                  {plan.shipping}
                </p>
              </div>

              <ul
                className={`flex min-h-0 flex-1 flex-col gap-2 border-t pt-4 text-left md:gap-2.5 md:pt-5 ${
                  plan.popular ? 'border-white/15' : 'border-coffee-brown/[0.1]'
                }`}
              >
                {plan.features.map((feature, fIdx) => (
                  <li key={fIdx} className="flex gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                        plan.popular ? 'bg-coffee-accent/25 text-coffee-accent' : 'bg-coffee-dark/10 text-coffee-dark'
                      }`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                    </span>
                    <span
                      className={`min-w-0 flex-1 text-[13px] leading-snug md:text-sm ${
                        plan.popular ? 'text-coffee-beige/90' : 'text-coffee-brown/85'
                      }`}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => onAddToCart({ ...plan, kind: 'plan' })}
                className={`mt-auto w-full shrink-0 rounded-2xl py-3.5 text-[10px] font-black uppercase tracking-[0.28em] transition-all ${
                  plan.popular
                    ? 'bg-coffee-beige text-coffee-dark shadow-md hover:bg-white active:scale-[0.99]'
                    : 'bg-coffee-dark text-coffee-beige shadow-md hover:bg-coffee-brown active:scale-[0.99]'
                }`}
              >
                Adicionar ao carrinho
              </button>
            </motion.div>
          ))}
        </div>

        <div className="mt-3 shrink-0 text-center space-y-1">
          <p className="text-coffee-brown/45 text-[9px] md:text-[10px] font-black uppercase tracking-[0.28em]">
            Torra fresca garantida · Máximo 1 mês de torra
          </p>
          <p className="text-[10px] text-coffee-brown/40 md:hidden">Deslize para ver os planos</p>
        </div>
      </div>
    </section>
  );
};

const Story = () => (
  <section
    id="story"
    className="snap-section relative flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden px-5 py-12 md:px-10 md:py-14 bg-coffee-dark text-coffee-beige"
  >
    <div className="absolute inset-0 z-0 opacity-[0.22] pointer-events-none">
      <img
        src="https://images.unsplash.com/photo-1447933601403-0c6688de566e?auto=format&fit=crop&q=80&w=2070"
        alt="Grãos de café — fundo da seção Nossa Herança"
        className="h-full w-full object-cover object-center"
        referrerPolicy="no-referrer"
      />
    </div>
    <div className="absolute inset-0 z-[1] bg-gradient-to-b from-coffee-dark/85 via-coffee-dark/75 to-coffee-dark/90" />

    <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col justify-center text-center">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="flex flex-col justify-center min-h-0 py-2"
      >
        <span className="text-coffee-accent uppercase tracking-[0.45em] text-[11px] md:text-xs font-black mb-4 md:mb-5 block shrink-0">
          Nossa Herança
        </span>
        <h2 className="text-coffee-beige mb-5 md:mb-7 text-[clamp(1.65rem,5.25vmin,3.85rem)] font-serif leading-[1.12] tracking-tight font-medium shrink-0 text-balance">
          O café é mais do que um hábito. É uma experiência.
        </h2>
        <div className="space-y-5 md:space-y-6 text-coffee-beige/88 text-[clamp(1rem,2.65vmin,1.45rem)] md:text-[clamp(1.05rem,2.35vmin,1.5rem)] leading-relaxed font-medium text-pretty text-balance min-h-0 text-left md:text-center">
          <p className="italic">
            Na JC COFFEE, acreditamos que cada xícara carrega tempo, origem e significado. Não se trata apenas do sabor — mas da atmosfera que ele cria, dos encontros que inspira e das histórias que desperta.
          </p>
          <p className="italic">
            Nossa essência nasce de uma herança real. Gerações que viveram do café, que encontraram nele sustento e propósito. Mesmo quando o tempo mudou os caminhos, a conexão permaneceu — silenciosa, mas presente.
          </p>
          <p className="text-coffee-beige font-serif not-italic text-[clamp(1.2rem,3vmin,1.75rem)] pt-1">
            Foi dessa memória que surgiu a JC COFFEE.
          </p>
          <p className="not-italic leading-relaxed">
            Uma marca construída sobre respeito à origem, seleção criteriosa e atenção absoluta a cada detalhe. Trabalhamos diretamente com produtores, valorizando processos autênticos e garantindo que cada grão expresse sua verdadeira identidade.
          </p>
        </div>
        <div className="mt-6 md:mt-8 w-20 md:w-24 h-0.5 bg-coffee-accent mx-auto shrink-0" />
      </motion.div>
    </div>
  </section>
);

const Experience = () => (
  <section className="snap-section relative min-h-[100dvh] max-h-[100dvh] flex flex-col justify-center overflow-hidden px-5 md:px-8 py-10 md:py-12 bg-coffee-beige grain-texture">
    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-14 items-center min-h-0 flex-1">
      <motion.div
        initial={{ opacity: 0, x: -32 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 1 }}
        className="min-h-0"
      >
        <h2 className="text-coffee-dark mb-5 md:mb-6 text-[clamp(1.45rem,4vmin,3rem)] leading-[1.12] font-serif font-medium tracking-tight">
          Café é encontro. <br />
          É pausa. <br />
          <span className="italic font-light text-coffee-accent">É presença.</span>
        </h2>
        <p className="text-coffee-brown/75 text-[clamp(0.9rem,2.1vmin,1.35rem)] font-medium leading-relaxed italic max-w-xl">
          O café nunca foi só o que está na xícara — é quem está ao seu lado e as histórias a cada gole.
        </p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 md:gap-6 min-h-0 max-h-[min(52vh,420px)] lg:max-h-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="rounded-2xl md:rounded-[2rem] overflow-hidden coffee-shadow aspect-square min-h-0"
        >
          <img
            src="https://images.unsplash.com/photo-1511920170033-f8396924c348?auto=format&fit=crop&q=80&w=1000"
            alt="Preparando café"
            className="h-full w-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl md:rounded-[2rem] overflow-hidden coffee-shadow aspect-square min-h-0 translate-y-4 md:translate-y-6 lg:translate-y-8"
        >
          <img
            src="https://images.unsplash.com/photo-1517705008128-361805f42e86?auto=format&fit=crop&q=80&w=1000"
            alt="Pessoas compartilhando café"
            className="h-full w-full object-cover object-center"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>
    </div>
  </section>
);

const CTA = () => (
  <section className="snap-section relative min-h-[100dvh] max-h-[100dvh] flex flex-col items-center justify-center text-center bg-white wood-texture overflow-hidden px-6 py-12">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 1 }}
      className="relative z-10 max-w-3xl mx-auto"
    >
      <h2 className="text-coffee-dark mb-8 md:mb-10 text-[clamp(1.5rem,5vmin,3.5rem)] leading-[1.1] font-serif font-medium tracking-tight">
        Leve mais do que café. <br />
        <span className="italic font-light text-coffee-accent">Leve propósito.</span>
      </h2>
      <a href="#products" className="btn-premium inline-block text-sm md:text-base uppercase tracking-[0.35em] px-12 md:px-16 py-5 md:py-6">
        Ver cafés
      </a>
    </motion.div>
    <div className="absolute inset-0 kraft-texture opacity-[0.06] pointer-events-none" />
  </section>
);

const Footer = () => (
  <footer className="bg-coffee-dark text-coffee-beige py-16 md:py-20 px-6 md:px-8">
    <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
      <Logo className="h-16 md:h-20 mb-10 md:mb-12" light />

      <div className="flex flex-wrap justify-center gap-x-10 gap-y-4 mb-12 md:mb-14 text-[11px] md:text-[12px] font-black uppercase tracking-[0.3em] text-coffee-beige/60">
        <a href="#home" className="hover:text-white transition-colors">Início</a>
        <a href="#origin" className="hover:text-white transition-colors">Origem</a>
        <a href="#products" className="hover:text-white transition-colors">Cafés</a>
        <a href="#monte-club" className="hover:text-white transition-colors">Monte Club</a>
        <a href="#story" className="hover:text-white transition-colors">História</a>
        <a href="https://instagram.com/ojccoffee" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:text-white transition-colors">
          <Instagram size={18} /> @ojccoffee
        </a>
      </div>

      <div className="w-full max-w-2xl h-px bg-white/10 mb-10 md:mb-12" />
      
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
    <section id="admin" className="py-32 px-6 md:px-8 bg-white min-h-screen [scroll-snap-align:none]">
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
  const [isContactOpen, setIsContactOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signin');
  const [authCity, setAuthCity] = useState('');
  const [authAddress, setAuthAddress] = useState('');
  const [authCep, setAuthCep] = useState('');
  const [authCpf, setAuthCpf] = useState('');
  const [authPhone, setAuthPhone] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authPasswordConfirm, setAuthPasswordConfirm] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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

  const resolveCheckoutIdentity = () => {
    if (user?.email) {
      return {
        userId: user.uid,
        payerEmail: user.email,
      };
    }

    const typedEmail = window.prompt('Digite seu e-mail para continuar com o checkout:');
    if (!typedEmail) return null;

    const payerEmail = typedEmail.trim().toLowerCase();
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicEmailRegex.test(payerEmail)) {
      alert('E-mail inválido. Tente novamente.');
      return null;
    }

    return {
      userId: `guest-${crypto.randomUUID()}`,
      payerEmail,
    };
  };

  const resetAuthFields = () => {
    setAuthEmail('');
    setAuthPassword('');
    setAuthPasswordConfirm('');
    setAuthCity('');
    setAuthAddress('');
    setAuthCep('');
    setAuthCpf('');
    setAuthPhone('');
    setAuthError(null);
  };

  const closeAuthModal = () => {
    setIsLoginOpen(false);
    setAuthLoading(false);
    resetAuthFields();
  };

  const openLoginModal = () => {
    setAuthMode('signin');
    resetAuthFields();
    setIsLoginOpen(true);
  };

  const handleAuthWithGoogle = async () => {
    try {
      setAuthLoading(true);
      setAuthError(null);
      const result = await signInWithGoogle();
      if (result?.user) {
        await ensureUserProfile(result.user);
        closeAuthModal();
      } else {
        setAuthError('Redirecionando para o Google...');
      }
    } catch (error) {
      console.error('Erro ao entrar com Google:', error);
      setAuthError('Não foi possível autenticar com Google. Verifique se o provedor Google está habilitado no Firebase Auth e tente novamente.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = authEmail.trim().toLowerCase();
    const phone = authPhone.trim();
    const city = authCity.trim();
    const address = authAddress.trim();
    const cepDigits = digitsOnly(authCep);
    const cpfDigits = digitsOnly(authCpf);

    if (!email || !authPassword) {
      setAuthError('Preencha e-mail e senha.');
      return;
    }
    if (authMode === 'signup') {
      if (!phone) {
        setAuthError('Informe o telefone.');
        return;
      }
      if (!city) {
        setAuthError('Informe a cidade.');
        return;
      }
      if (!address) {
        setAuthError('Informe o endereço completo.');
        return;
      }
      if (cepDigits.length !== 8) {
        setAuthError('CEP deve ter 8 dígitos.');
        return;
      }
      if (!isValidCpf(authCpf)) {
        setAuthError('CPF inválido. Confira os dígitos.');
        return;
      }
    }
    if (authPassword.length < 6) {
      setAuthError('A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (authMode === 'signup') {
      if (!authPasswordConfirm.trim()) {
        setAuthError('Digite novamente a senha no campo de confirmação.');
        return;
      }
      if (authPassword !== authPasswordConfirm) {
        setAuthError('A senha e a confirmação não coincidem.');
        return;
      }
    }

    try {
      setAuthLoading(true);
      setAuthError(null);
      if (authMode === 'signup') {
        const credential = await signUpWithEmailPassword(email, authPassword);
        const displayLabel = email.split('@')[0] || 'Cliente';
        await updateProfile(credential.user, { displayName: displayLabel });
        await setDoc(
          doc(db, 'users', credential.user.uid),
          {
            uid: credential.user.uid,
            email,
            displayName: displayLabel,
            phone,
            cpf: cpfDigits,
            cep: cepDigits,
            city,
            address,
            role: 'customer',
            createdAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await signInWithEmailPassword(email, authPassword);
      }
      closeAuthModal();
    } catch (error) {
      console.error('Erro na autenticação por e-mail:', error);
      setAuthError(
        authMode === 'signup'
          ? 'Não foi possível criar sua conta. Verifique os dados e tente novamente.'
          : 'Não foi possível entrar. Verifique e-mail/senha e tente novamente.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const addToCart = (item: any) => {
    setCart((prev) => [...prev, item]);
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const identity = resolveCheckoutIdentity();
    if (!identity) return;

    try {
      const items = cart.map((item) => ({
        title:
          item.kind === 'product'
            ? `${item.name} — Café especial`
            : `Monte Club — ${item.name}`,
        quantity: 1,
        unit_price: Number(String(item.price).replace(',', '.')),
        currency_id: 'BRL',
      }));

      const response = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: identity.userId,
          payerEmail: identity.payerEmail,
          items,
        }),
      });

      const result = await response.json();
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(result.error || 'Falha ao iniciar checkout no Mercado Pago.');
      }

      window.open(result.checkoutUrl, '_blank');
    } catch (error) {
      console.error('Erro no checkout:', error);
      alert('Não foi possível iniciar o checkout do Mercado Pago.');
    }
  };

  const authFieldClass =
    authMode === 'signup'
      ? 'w-full bg-white border border-coffee-brown/10 rounded-lg px-2.5 py-1.5 text-[13px] leading-tight text-coffee-dark min-w-0 transition-[border-color,box-shadow] duration-150'
      : 'w-full bg-white border border-coffee-brown/10 rounded-xl px-3 py-2.5 text-sm text-coffee-dark transition-[border-color,box-shadow] duration-150';
  const authGridGap = authMode === 'signup' ? 'gap-1.5' : 'gap-2';
  const authFormSpace = authMode === 'signup' ? 'space-y-1.5' : 'space-y-2.5';
  const signupPasswordMismatch =
    authMode === 'signup' &&
    authPassword.length > 0 &&
    authPasswordConfirm.length > 0 &&
    authPassword !== authPasswordConfirm;

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
          onOpenLogin={openLoginModal}
          onOpenContact={() => setIsContactOpen(true)}
        />
        
        {/* Login Modal */}
        <AnimatePresence>
          {isLoginOpen && !user && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={closeAuthModal}
                className="fixed inset-0 bg-coffee-dark/80 backdrop-blur-md z-[100]"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className={`fixed mx-auto w-full bg-coffee-beige z-[110] rounded-2xl md:rounded-3xl text-center coffee-shadow flex flex-col overflow-hidden ${
                  authMode === 'signup'
                    ? 'inset-x-3 top-1/2 -translate-y-1/2 max-h-[min(calc(100dvh-24px),92dvh)] max-w-2xl px-4 pt-4 pb-3 sm:px-5 gap-2.5 min-h-0'
                    : 'inset-x-4 top-1/2 -translate-y-1/2 max-h-[min(92dvh,820px)] max-w-lg px-6 py-6 gap-4'
                }`}
              >
                <div className={`flex flex-col items-center shrink-0 ${authMode === 'signup' ? 'gap-1' : 'gap-2'}`}>
                  <Logo
                    className={
                      authMode === 'signup'
                        ? 'h-12 md:h-14 mx-auto shrink-0'
                        : 'h-[6.375rem] md:h-[7.875rem] mx-auto shrink-0'
                    }
                    premiumTint
                  />
                  <h2
                    className={`font-serif text-coffee-dark leading-tight ${
                      authMode === 'signup' ? 'text-base md:text-lg' : 'text-lg md:text-xl'
                    }`}
                  >
                    {authMode === 'signup' ? 'Crie sua conta' : 'Entre na sua conta'}
                  </h2>
                  {authMode !== 'signup' && (
                    <p className="text-coffee-brown/55 leading-snug max-w-md mx-auto text-xs md:text-sm">
                      E-mail e senha, ou Google.
                    </p>
                  )}
                </div>

                <div
                  className={`w-full min-w-0 shrink-0 overflow-y-auto overscroll-contain ${
                    authMode === 'signup'
                      ? 'max-h-[min(72dvh,640px)]'
                      : 'max-h-[min(48dvh,400px)] pr-0.5 -mr-0.5'
                  }`}
                >
                <form
                  onSubmit={handleEmailAuthSubmit}
                  className={`${authFormSpace} text-left flex flex-col w-full`}
                >
                  {authMode === 'signup' && (
                    <>
                      <div className={`grid grid-cols-2 ${authGridGap}`}>
                        <input
                          type="email"
                          value={authEmail}
                          onChange={(e) => setAuthEmail(e.target.value)}
                          placeholder="E-mail"
                          className={authFieldClass}
                          autoComplete="email"
                          inputMode="email"
                          required
                        />
                        <input
                          type="tel"
                          value={authPhone}
                          onChange={(e) => setAuthPhone(e.target.value)}
                          placeholder="Telefone"
                          className={authFieldClass}
                          autoComplete="tel"
                          required
                        />
                      </div>
                      <div className="min-h-0 shrink">
                        <div className="relative">
                          <input
                            type="text"
                            value={authCpf}
                            onChange={(e) => setAuthCpf(formatCpfMask(e.target.value))}
                            placeholder="CPF"
                            className={`${authFieldClass} pr-9 ${
                              digitsOnly(authCpf).length === 11
                                ? isValidCpf(authCpf)
                                  ? 'border-green-600 ring-1 ring-green-600/30'
                                  : 'border-red-400 ring-1 ring-red-200'
                                : 'border-coffee-brown/10'
                            }`}
                            autoComplete="off"
                            inputMode="numeric"
                            required
                            maxLength={14}
                            aria-invalid={digitsOnly(authCpf).length === 11 ? !isValidCpf(authCpf) : undefined}
                            aria-describedby="auth-cpf-hint"
                          />
                          {digitsOnly(authCpf).length === 11 && isValidCpf(authCpf) && (
                            <Check
                              className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-green-600"
                              strokeWidth={3}
                              aria-hidden={true}
                            />
                          )}
                        </div>
                        <p id="auth-cpf-hint" className="min-h-[12px] text-[9px] leading-none text-coffee-brown/45 text-left">
                          {digitsOnly(authCpf).length === 11
                            ? isValidCpf(authCpf)
                              ? 'CPF válido.'
                              : 'CPF inválido.'
                            : '11 dígitos.'}
                        </p>
                      </div>
                      <div className={`grid grid-cols-2 ${authGridGap}`}>
                        <input
                          type="text"
                          value={authCep}
                          onChange={(e) => setAuthCep(formatCepMask(e.target.value))}
                          placeholder="CEP"
                          className={authFieldClass}
                          autoComplete="postal-code"
                          inputMode="numeric"
                          required
                          maxLength={9}
                        />
                        <input
                          type="text"
                          value={authCity}
                          onChange={(e) => setAuthCity(e.target.value)}
                          placeholder="Cidade"
                          className={authFieldClass}
                          autoComplete="address-level2"
                          required
                        />
                      </div>
                      <input
                        type="text"
                        value={authAddress}
                        onChange={(e) => setAuthAddress(e.target.value)}
                        placeholder="Endereço (rua, nº, compl.)"
                        className={authFieldClass}
                        autoComplete="street-address"
                        required
                      />
                      <div className={`grid grid-cols-2 ${authGridGap}`}>
                        <input
                          type="password"
                          value={authPassword}
                          onChange={(e) => setAuthPassword(e.target.value)}
                          placeholder="Senha"
                          className={`${authFieldClass} ${signupPasswordMismatch ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                          autoComplete="new-password"
                          minLength={6}
                          required
                          aria-invalid={signupPasswordMismatch || undefined}
                        />
                        <input
                          type="password"
                          value={authPasswordConfirm}
                          onChange={(e) => setAuthPasswordConfirm(e.target.value)}
                          placeholder="Confirmar senha"
                          className={`${authFieldClass} ${signupPasswordMismatch ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                          autoComplete="new-password"
                          minLength={6}
                          required
                          aria-invalid={signupPasswordMismatch || undefined}
                        />
                      </div>
                      <div className="min-h-[13px] text-left">
                        {authMode === 'signup' &&
                          authPassword.length > 0 &&
                          authPasswordConfirm.length > 0 &&
                          authPassword === authPasswordConfirm &&
                          authPassword.length >= 6 && (
                            <p id="auth-pwd-match-hint" className="text-[9px] leading-none text-green-700 font-semibold">
                              Senhas conferem.
                            </p>
                          )}
                      </div>
                    </>
                  )}
                  {authMode === 'signin' && (
                    <>
                      <input
                        type="email"
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="E-mail"
                        className={authFieldClass}
                        autoComplete="email"
                        required
                      />
                      <input
                        type="password"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Senha"
                        className={authFieldClass}
                        autoComplete="current-password"
                        minLength={6}
                        required
                      />
                    </>
                  )}
                  {authError && (
                    <p className="text-[11px] text-red-600 font-medium leading-snug">{authError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={
                      authLoading ||
                      (authMode === 'signup' && digitsOnly(authCpf).length === 11 && !isValidCpf(authCpf)) ||
                      signupPasswordMismatch
                    }
                    className={`w-full btn-premium font-bold tracking-wide disabled:opacity-60 ${
                      authMode === 'signup' ? 'py-2.5 text-[11px]' : 'py-3 text-xs'
                    }`}
                  >
                    {authLoading ? 'Processando...' : authMode === 'signup' ? 'Criar conta' : 'Entrar com e-mail'}
                  </button>
                </form>
                </div>

                <div className={`flex flex-col shrink-0 w-full ${authMode === 'signup' ? 'gap-2' : 'gap-3'}`}>
                  <button 
                    type="button"
                    onClick={handleAuthWithGoogle}
                    disabled={authLoading}
                    className={`w-full flex items-center justify-center gap-2 bg-white border border-coffee-brown/15 rounded-xl text-coffee-dark font-bold hover:bg-white/90 transition-colors disabled:opacity-60 shadow-sm ${
                      authMode === 'signup' ? 'py-2 text-xs' : 'py-2.5 text-sm'
                    }`}
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className={authMode === 'signup' ? 'w-4 h-4 shrink-0' : 'w-5 h-5 shrink-0'} />
                    {authMode === 'signup' ? 'Cadastrar com Google' : 'Entrar com Google'}
                  </button>

                  <div className="flex flex-col items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthError(null);
                        setAuthPassword('');
                        setAuthPasswordConfirm('');
                        if (authMode === 'signup') {
                          setAuthCity('');
                          setAuthAddress('');
                          setAuthCep('');
                          setAuthCpf('');
                          setAuthPhone('');
                        }
                        setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                      }}
                      className="text-[10px] font-black uppercase tracking-widest text-coffee-accent hover:opacity-75 transition-opacity py-0.5"
                    >
                      {authMode === 'signup' ? 'Já tenho conta' : 'Quero criar conta'}
                    </button>
                    <button
                      type="button"
                      onClick={closeAuthModal}
                      className="text-[9px] uppercase font-black tracking-widest text-coffee-brown/45 hover:text-coffee-dark transition-colors py-0.5"
                    >
                      Voltar ao site
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Contact Modal */}
        <AnimatePresence>
          {isContactOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsContactOpen(false)}
                className="fixed inset-0 bg-coffee-dark/75 backdrop-blur-md z-[85]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94, y: 16 }}
                className="fixed inset-x-4 top-1/2 -translate-y-1/2 mx-auto w-full max-w-md max-h-[90dvh] overflow-y-auto bg-coffee-beige z-[90] rounded-3xl p-8 md:p-10 coffee-shadow text-left"
              >
                <div className="flex justify-between items-start gap-4 mb-6">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em] text-coffee-accent mb-2">Contato</p>
                    <h2 className="text-2xl md:text-3xl font-serif text-coffee-dark leading-tight">Fale com a Jccoffee</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsContactOpen(false)}
                    className="p-2 text-coffee-dark hover:opacity-60 shrink-0"
                    aria-label="Fechar"
                  >
                    <X size={22} />
                  </button>
                </div>
                <p className="text-sm text-coffee-brown/65 mb-8 leading-relaxed">
                  Tire dúvidas sobre pedidos, cafés ou parcerias. Preferir WhatsApp? É só clicar abaixo.
                </p>
                <div className="space-y-4">
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/70 border border-coffee-brown/10 hover:border-coffee-dark/20 transition-colors"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coffee-dark/10 text-coffee-dark">
                      <Mail size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-widest text-coffee-brown/45 mb-0.5">E-mail</p>
                      <p className="text-coffee-dark font-medium break-all">{CONTACT_EMAIL}</p>
                    </div>
                  </a>
                  <a
                    href={`tel:${CONTACT_PHONE_E164.replace(/\s/g, '')}`}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-white/70 border border-coffee-brown/10 hover:border-coffee-dark/20 transition-colors"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coffee-dark/10 text-coffee-dark">
                      <Phone size={20} />
                    </span>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-coffee-brown/45 mb-0.5">Telefone</p>
                      <p className="text-coffee-dark font-medium">{CONTACT_PHONE_LABEL}</p>
                    </div>
                  </a>
                  <a
                    href={`https://wa.me/${CONTACT_WHATSAPP_DIGITS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-[#25D366]/15 text-coffee-dark font-bold text-sm hover:bg-[#25D366]/25 transition-colors border border-[#25D366]/30"
                  >
                    WhatsApp
                  </a>
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
                      <div key={idx} className="bg-white/50 p-6 rounded-2xl border border-coffee-brown/5 flex justify-between items-center gap-4">
                        <div className="min-w-0">
                          <h4 className="font-serif text-xl text-coffee-dark">{item.name}</h4>
                          <p className="text-sm text-coffee-brown/60">
                            {item.kind === 'product'
                              ? `Café especial${item.shipping ? ` · ${item.shipping}` : ''}`
                              : 'Monte Club · assinatura mensal'}
                          </p>
                          <p className="mt-2 font-bold text-coffee-accent">R$ {item.price}</p>
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
                      type="button"
                      onClick={handleCheckout}
                      className="btn-premium w-full py-6 text-lg uppercase tracking-[0.3em]"
                    >
                      Finalizar compra
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <Hero />
        <Origin />
        <Products onAddToCart={addToCart} />
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



