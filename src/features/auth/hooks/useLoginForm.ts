import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type SubmitHandler } from "react-hook-form";
import { loginSchema, type LoginFormInput, type LoginFormValues } from "@/features/auth/schemas/authSchemas";

export function useLoginForm(onValid?: SubmitHandler<LoginFormValues>, email = "") {
  const form = useForm<LoginFormInput, unknown, LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email, password: "" },
    mode: "onTouched",
  });

  const onSubmit = form.handleSubmit(async (values, event) => {
    await onValid?.(values, event);
  });

  return { form, onSubmit };
}
