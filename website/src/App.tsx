import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ScreenshotGallery } from './components/ScreenshotGallery';
import { WhyLifeMirror } from './components/WhyLifeMirror';
import { SCurveDemo } from './components/SCurveDemo';
import { LocalAiSimulator } from './components/LocalAiSimulator';
import { InterdictionDemo } from './components/InterdictionDemo';
import { PrivacyInspector } from './components/PrivacyInspector';
import { ArchitectureSection } from './components/ArchitectureSection';
import { PricingSection } from './components/PricingSection';
import { FaqSection } from './components/FaqSection';
import { FeatureGrid } from './components/FeatureGrid';
import { DownloadSection } from './components/DownloadSection';
import { DocsHub } from './components/DocsHub';
import { Footer } from './components/Footer';

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <div className="min-h-screen bg-[#0d0d11] text-gray-100 selection:bg-violet-500 selection:text-white transition-colors duration-300">
      <Navbar theme={theme} onToggleTheme={toggleTheme} />
      <main>
        <HeroSection />
        <ScreenshotGallery />
        <WhyLifeMirror />
        <SCurveDemo />
        <LocalAiSimulator />
        <InterdictionDemo />
        <PrivacyInspector />
        <ArchitectureSection />
        <PricingSection />
        <FaqSection />
        <FeatureGrid />
        <DownloadSection />
        <DocsHub />
      </main>
      <Footer />
    </div>
  );
};

export default App;
