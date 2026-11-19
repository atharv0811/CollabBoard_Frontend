import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { Divider } from "@/components/common/Divider";
import { IconButton } from "@/components/common/IconButton";
import { Input } from "@/components/common/Input";
import { Button } from "@/components/ui/button";
import { AuthCard } from "@/features/auth/components/AuthCard";
import { FormField } from "@/features/auth/components/FormField";
import { SocialAuthButton } from "@/features/auth/components/SocialAuthButton";
import { useLoginUserMutation } from "@/features/auth/hooks/loginUserMutation";
import { useLoginForm } from "@/features/auth/hooks/useLoginForm";
import { fieldAria } from "@/features/auth/lib/fieldAria";
import { getApiErrorMessage } from "@/lib/apiError";
import { paths } from "@/lib/paths";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from ?? paths.workspace;
  const loginMutation = useLoginUserMutation();
  const [showPassword, setShowPassword] = useState(false);

  const { form, onSubmit } = useLoginForm((data) => {
    loginMutation.mutate(
      {
        email: data.email,
        password: data.password,
      },
      {
        onSuccess: ({ user }) => {
          toast.success(`Welcome back, ${user.name}!`);
          navigate(redirectTo, { replace: true });
        },
        onError: (error) => {
          toast.error(getApiErrorMessage(error, "Couldn't log you in. Please try again."), { id: "login-error" });
        },
      },
    );
  });

  const {
    register,
    formState: { errors },
  } = form;
  const isLoggingIn = loginMutation.isPending;

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
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Enter your password"
            icon={Lock}
            trailing={
              <IconButton
                icon={showPassword ? EyeOff : Eye}
                label={showPassword ? "Hide password" : "Show password"}
                size="sm"
                onClick={() => setShowPassword(!showPassword)}
              />
            }
            {...fieldAria("login-password", { error: errors.password?.message })}
            {...register("password")}
          />
        </FormField>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={isLoggingIn}>
          {isLoggingIn ? "Logging in…" : "Log in"}
        </Button>
      </form>
    </AuthCard>
  );
}
