import { BenefitsSection } from "@/features/landing/components/BenefitsSection";
import { FeaturesSection } from "@/features/landing/components/FeaturesSection";
import { FinalCta } from "@/features/landing/components/FinalCta";
import { HeroSection } from "@/features/landing/components/HeroSection";
import { HowItWorksSection } from "@/features/landing/components/HowItWorksSection";

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <HowItWorksSection />
      <BenefitsSection />
      <FinalCta />
    </main>
  );
}
