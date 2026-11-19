import { Link } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { Checkbox } from "@/components/common/Checkbox";
import { Divider } from "@/components/common/Divider";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormField } from "@/features/auth/components/FormField";
import { SocialAuthButton } from "@/features/auth/components/SocialAuthButton";
import { paths } from "@/lib/paths";

export default function LoginPage() {
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your CollabBoard account to continue."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link to={paths.register} className="font-medium text-link underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <SocialAuthButton label="Continue with Google" />

      <Divider label="or continue with email" className="my-6" />

      <form noValidate className="flex flex-col gap-5">
        <FormField label="Email" htmlFor="login-email">
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            icon={Mail}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="login-password"
          labelAside={
            <Link
              to={paths.forgotPassword}
              className="text-xs font-medium text-link underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={Lock}
          />
        </FormField>

        <Checkbox id="login-remember" name="remember" label="Remember me for 30 days" />

        <Button type="button" size="lg" className="mt-1 w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
