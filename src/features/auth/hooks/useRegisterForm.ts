import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { registerSchema, type RegisterFormInput, type RegisterFormValues } from "@/features/auth/schemas/authSchemas";

const defaultValues: RegisterFormInput = { name: "", email: "", password: "", confirmPassword: "" };

export function useRegisterForm(onValid?: SubmitHandler<RegisterFormValues>) {
  const form = useForm<RegisterFormInput, unknown, RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues,
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit(async (values, event) => {
    await onValid?.(values, event);
  });

  return { form, onSubmit };
}
