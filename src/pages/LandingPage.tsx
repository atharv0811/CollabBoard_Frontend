import { Footer } from "@/components/layout/Footer";
import { MarketingNavbar } from "@/components/layout/MarketingNavbar";
import { BenefitsSection } from "@/features/landing/components/BenefitsSection";
import { FeaturesSection } from "@/features/landing/components/FeaturesSection";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";

export default function LandingPage() {
  return (
    <div className="min-h-svh bg-background">
      <MarketingNavbar />
      <main>
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <BenefitsSection />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
