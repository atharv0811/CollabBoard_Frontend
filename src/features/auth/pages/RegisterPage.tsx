import { Link } from "react-router-dom";
import { Lock, Mail, User } from "lucide-react";
import { Divider } from "@/components/common/Divider";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormField } from "@/features/auth/components/FormField";
import { SocialAuthButton } from "@/features/auth/components/SocialAuthButton";
import { useRegisterForm } from "@/features/auth/hooks/useRegisterForm";
import { fieldAria } from "@/features/auth/lib/fieldAria";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/schemas/authSchemas";
import { paths } from "@/lib/paths";

const passwordHint = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;

export default function RegisterPage() {
  const { form, onSubmit } = useRegisterForm();
  const {
    register,
    formState: { errors, isSubmitting },
  } = form;

  return (
    <AuthCard
      title="Create your account"
      description="Start sketching with your team in less than a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link to={paths.login} className="font-medium text-link underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SocialAuthButton label="Sign up with Google" />

      <Divider label="or sign up with email" className="my-6" />

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <FormField label="Full name" htmlFor="register-name" error={errors.name?.message}>
          <Input
            id="register-name"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            icon={User}
            {...fieldAria("register-name", { error: errors.name?.message })}
            {...register("name")}
          />
        </FormField>

        <FormField label="Email" htmlFor="register-email" error={errors.email?.message}>
          <Input
            id="register-email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            icon={Mail}
            {...fieldAria("register-email", { error: errors.email?.message })}
            {...register("email")}
          />
        </FormField>

        <FormField label="Password" htmlFor="register-password" hint={passwordHint} error={errors.password?.message}>
          <Input
            id="register-password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a password"
            icon={Lock}
            {...fieldAria("register-password", { error: errors.password?.message, hint: passwordHint })}
            {...register("password", { deps: ["confirmPassword"] })}
          />
        </FormField>

        <FormField label="Confirm password" htmlFor="register-confirm-password" error={errors.confirmPassword?.message}>
          <Input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat your password"
            icon={Lock}
            {...fieldAria("register-confirm-password", { error: errors.confirmPassword?.message })}
            {...register("confirmPassword")}
          />
        </FormField>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
          {isSubmitting ? "Creating account…" : "Create account"}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          By creating an account you agree to our{" "}
          <Link to={paths.terms} className="text-foreground underline underline-offset-4 hover:text-link">
            Terms
          </Link>{" "}
          and{" "}
          <Link to={paths.privacy} className="text-foreground underline underline-offset-4 hover:text-link">
            Privacy Policy
          </Link>
          .
        </p>
      </form>
    </AuthCard>
  );
}
