import { AuthLayout } from "@/components/screens/auth/AuthLayout";
import { LoginUnico } from "@/components/auth/LoginUnico";

export const metadata = {
  title: "Acceso — Portal de Compras BIA",
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <LoginUnico />
    </AuthLayout>
  );
}
