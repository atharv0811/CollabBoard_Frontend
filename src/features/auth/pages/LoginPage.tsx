import { Link } from "react-router-dom";
import { Lock, Mail } from "lucide-react";
import { Checkbox } from "@/components/common/Checkbox";
import { Divider } from "@/components/common/Divider";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormField } from "@/features/auth/components/FormField";
import { SocialAuthButton } from "@/features/auth/components/SocialAuthButton";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";
import { fieldAria } from "@/features/auth/lib/fieldAria";
import { paths } from "@/lib/paths";

export default function LoginPage() {
  const { form, onSubmit } = useLoginForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

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

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <FormField label="Email" htmlFor="login-email" error={errors.email?.message}>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            icon={Mail}
            {...fieldAria("login-email", { error: errors.email?.message })}
            {...register("email")}
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="login-password"
          error={errors.password?.message}
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
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={Lock}
            {...fieldAria("login-password", { error: errors.password?.message })}
            {...register("password")}
          />
        </FormField>

        <Checkbox id="login-remember" label="Remember me for 30 days" {...register("remember")} />

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
