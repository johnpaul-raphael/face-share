'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  Camera, Scan, Users, Zap, Shield, Share2,
  ArrowRight, Clock,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { AccentPicker } from '@/components/accent-picker';
import { fadeInUp, fadeInScale, staggerContainer, staggerItem } from '@/lib/animations';

/* ── Static data ───────────────────────────────────────────────────────── */
const STEPS = [
  {
    num: '01',
    title: 'Set Up Your Face Profile',
    desc: 'Upload 3 clear photos of your face. Our AI learns to recognise you in any lighting or angle.',
  },
  {
    num: '02',
    title: 'Join an Event',
    desc: 'Enter a 6-character join code from the organiser. You\'re instantly part of the event gallery.',
  },
  {
    num: '03',
    title: 'Receive Your Photos',
    desc: 'As photos are uploaded, only the ones containing your face appear in your personal gallery.',
  },
];

const FEATURES = [
  { icon: Scan,    title: 'AI Face Recognition',  desc: 'Advanced AI automatically identifies you in every photo taken at the event.' },
  { icon: Zap,     title: 'Instant Delivery',     desc: 'Photos appear in your gallery the moment they\'re processed — no waiting.' },
  { icon: Shield,  title: 'Private & Secure',     desc: 'Your photos are only visible to you. No one else can access your matched photos.' },
  { icon: Users,   title: 'Group Events',         desc: 'Photographers upload once; everyone gets their own personalised photo collection.' },
  { icon: Share2,  title: 'Easy Sharing',         desc: 'Share your event gallery with friends and family via link or WhatsApp instantly.' },
  { icon: Clock,   title: 'Always Available',     desc: 'Join multiple events and access all your photos from any device, any time.' },
];

const USE_CASES = [
  { emoji: '💍', title: 'Weddings',          desc: 'Every guest gets their own collection of memories from the big day.' },
  { emoji: '🎂', title: 'Birthdays',         desc: 'Automatically sort hundreds of photos to everyone who attended.' },
  { emoji: '🏢', title: 'Corporate Events',  desc: 'Conference photos delivered directly to every attendee\'s account.' },
  { emoji: '🎓', title: 'Graduations',       desc: 'Families find their graduate in every group shot automatically.' },
];

/* ── Component ─────────────────────────────────────────────────────────── */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) router.replace('/dashboard');
  }, [router]);

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: '#f8f5f0', color: '#0f1a2e' }}
    >

      {/* ── Sticky Navbar ──────────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 backdrop-blur-md border-b"
        style={{ background: 'rgba(248,245,240,0.85)', borderColor: '#e8e2d9' }}
      >
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
          <AppLogo />
          <Link href="/login">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all"
              style={{ background: 'var(--brand)' }}
            >
              Sign In
            </motion.button>
          </Link>
        </div>
      </header>

      <main>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="relative min-h-[92vh] flex items-center">
          {/* subtle grid pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              backgroundImage: 'linear-gradient(#e8e2d9 1px,transparent 1px),linear-gradient(90deg,#e8e2d9 1px,transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          <div className="container relative mx-auto px-4 md:px-6 py-24">
            <motion.div
              className="max-w-4xl mx-auto text-center space-y-8"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {/* Badge */}
              <motion.div variants={staggerItem}>
                <span
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border"
                  style={{ color: 'var(--brand)', borderColor: 'var(--brand)', background: 'rgba(201,150,58,0.06)' }}
                >
                  <Zap className="h-3.5 w-3.5" />
                  Powered by AI Face Recognition
                </span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={staggerItem}
                className="text-5xl sm:text-6xl lg:text-7xl font-bold leading-tight tracking-tight"
                style={{ color: '#0f1a2e' }}
              >
                Your Photos,{' '}
                <span style={{ color: 'var(--brand)' }}>Found Automatically</span>
              </motion.h1>

              {/* Subtext */}
              <motion.p
                variants={staggerItem}
                className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed"
                style={{ color: '#6b7280' }}
              >
                FaceShare scans every photo from your events and delivers only the ones you appear in —
                straight to your personal gallery. No searching, no scrolling, no effort.
              </motion.p>

              {/* CTAs */}
              <motion.div variants={staggerItem} className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/login">
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: '0 8px 32px rgba(201,150,58,0.35)' }}
                    whileTap={{ scale: 0.96 }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-white font-semibold text-base shadow-md transition-all"
                    style={{ background: 'var(--brand)' }}
                  >
                    <Camera className="h-4 w-4" />
                    Get Started — it&apos;s free
                    <ArrowRight className="h-4 w-4" />
                  </motion.button>
                </Link>
                <a href="#how-it-works">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full font-semibold text-base border transition-all"
                    style={{ borderColor: '#c8bfb0', color: '#0f1a2e', background: 'white' }}
                  >
                    See How It Works
                  </motion.button>
                </a>
              </motion.div>

              {/* Stats */}
              <motion.div
                variants={staggerItem}
                className="grid grid-cols-3 gap-6 max-w-sm mx-auto pt-6"
              >
                {[
                  { value: '100%', label: 'Automatic' },
                  { value: '< 1 min', label: 'Delivery' },
                  { value: '0', label: 'Manual work' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-2xl font-bold" style={{ color: 'var(--brand)' }}>{s.value}</div>
                    <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{s.label}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── How It Works ───────────────────────────────────────────────── */}
        <section id="how-it-works" className="py-28" style={{ background: 'white' }}>
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="text-center mb-16"
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--brand)' }}>
                How It Works
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: '#0f1a2e' }}>
                Three steps to your photos
              </h2>
            </motion.div>

            <motion.div
              className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {/* Connecting line (desktop only) */}
              <div
                className="hidden md:block absolute top-10 left-[calc(16.66%+1rem)] right-[calc(16.66%+1rem)] h-px"
                style={{ background: 'linear-gradient(90deg, var(--brand) 0%, #e8e2d9 100%)' }}
              />

              {STEPS.map((step) => (
                <motion.div
                  key={step.num}
                  variants={staggerItem}
                  whileHover={{ y: -6 }}
                  className="relative p-8 rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
                  style={{ borderColor: '#e8e2d9' }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm mb-5"
                    style={{ background: 'var(--brand)' }}
                  >
                    {step.num}
                  </div>
                  <h3 className="text-lg font-bold mb-2" style={{ color: '#0f1a2e' }}>{step.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{step.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────────── */}
        <section className="py-28" style={{ background: '#f8f5f0' }}>
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="text-center mb-16"
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--brand)' }}>
                Features
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: '#0f1a2e' }}>Everything you need</h2>
              <p className="mt-4 max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                Built for event organisers and attendees alike. No app download, no complicated setup.
              </p>
            </motion.div>

            <motion.div
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {FEATURES.map((f) => (
                <motion.div
                  key={f.title}
                  variants={staggerItem}
                  whileHover={{ y: -5 }}
                  className="p-6 rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md"
                  style={{ borderColor: '#e8e2d9' }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(201,150,58,0.1)' }}
                  >
                    <f.icon className="h-5 w-5" style={{ color: 'var(--brand)' }} />
                  </div>
                  <h3 className="font-semibold mb-1.5" style={{ color: '#0f1a2e' }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{f.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Use Cases ──────────────────────────────────────────────────── */}
        <section className="py-28" style={{ background: 'white' }}>
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="text-center mb-16"
              variants={fadeInUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--brand)' }}>
                Perfect For
              </p>
              <h2 className="text-4xl sm:text-5xl font-bold" style={{ color: '#0f1a2e' }}>Every kind of event</h2>
            </motion.div>

            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-5 max-w-4xl mx-auto"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              {USE_CASES.map((u) => (
                <motion.div
                  key={u.title}
                  variants={staggerItem}
                  whileHover={{ y: -5, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
                  className="p-6 rounded-2xl border bg-white text-center transition-all"
                  style={{ borderColor: '#e8e2d9' }}
                >
                  <div className="text-4xl mb-3">{u.emoji}</div>
                  <h3 className="font-semibold mb-1.5 text-sm" style={{ color: '#0f1a2e' }}>{u.title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: '#9ca3af' }}>{u.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* ── Final CTA ──────────────────────────────────────────────────── */}
        <section className="py-28" style={{ background: '#f8f5f0' }}>
          <div className="container mx-auto px-4 md:px-6">
            <motion.div
              className="max-w-2xl mx-auto text-center p-12 rounded-3xl border"
              style={{ borderColor: '#e8e2d9', background: 'white', boxShadow: '0 4px 40px rgba(201,150,58,0.12)' }}
              variants={fadeInScale}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                style={{ background: 'var(--brand)' }}
              >
                <Camera className="h-7 w-7 text-white" />
              </div>
              <h2 className="text-4xl sm:text-5xl font-bold mb-4" style={{ color: '#0f1a2e' }}>
                Never miss a photo of you
              </h2>
              <p className="mb-8 text-lg" style={{ color: '#6b7280' }}>
                Join FaceShare today and let AI find every photo of you, automatically.
              </p>
              <Link href="/login">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(201,150,58,0.4)' }}
                  whileTap={{ scale: 0.96 }}
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-full text-white font-semibold text-lg transition-all shadow-md"
                  style={{ background: 'var(--brand)' }}
                >
                  Sign in with Google
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="py-8 border-t" style={{ background: 'white', borderColor: '#e8e2d9' }}>
        <div className="container mx-auto px-4 md:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <AppLogo />
          <p className="text-sm" style={{ color: '#9ca3af' }}>© 2025 FaceShare. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Floating Colour Picker ──────────────────────────────────────── */}
      <AccentPicker />

    </div>
  );
}
