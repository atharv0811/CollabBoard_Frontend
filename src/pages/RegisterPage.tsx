import { Lock, Mail, User } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { Input } from "@/components/common/Input";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormField } from "@/features/auth/components/FormField";
import { SocialAuthButton } from "@/features/auth/components/SocialAuthButton";
import { paths } from "@/lib/paths";

export default function RegisterPage() {
  return (
    <AuthLayout
      panelTitle="Where scattered ideas become shared plans."
      panelDescription="Create boards, invite your team and think out loud together on one endless canvas."
    >
      <AuthCard
        title="Create your account"
        description="Start sketching with your team in less than a minute."
        footer={
          <>
            Already have an account?{" "}
            <a href={paths.login} className="font-medium text-link underline-offset-4 hover:underline">
              Log in
            </a>
          </>
        }
      >
        <SocialAuthButton label="Sign up with Google" />

        <Divider label="or sign up with email" className="my-6" />

        <form noValidate className="flex flex-col gap-5">
          <FormField label="Full name" htmlFor="register-name">
            <Input
              id="register-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Alex Morgan"
              icon={User}
            />
          </FormField>

          <FormField label="Email" htmlFor="register-email">
            <Input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              icon={Mail}
            />
          </FormField>

          <FormField label="Password" htmlFor="register-password" hint="Use at least 8 characters.">
            <Input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              placeholder="Create a password"
              icon={Lock}
              aria-describedby="register-password-hint"
            />
          </FormField>

          <FormField label="Confirm password" htmlFor="register-confirm-password">
            <Input
              id="register-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Repeat your password"
              icon={Lock}
            />
          </FormField>

          <Button type="button" size="lg" className="mt-1 w-full">
            Create account
          </Button>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">
            By creating an account you agree to our{" "}
            <a href={paths.terms} className="text-foreground underline underline-offset-4 hover:text-link">
              Terms
            </a>{" "}
            and{" "}
            <a href={paths.privacy} className="text-foreground underline underline-offset-4 hover:text-link">
              Privacy Policy
            </a>
            .
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
