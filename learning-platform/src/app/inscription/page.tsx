import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Inscription gratuite",
  description:
    "Créez votre compte Tech Nest gratuit : progression sauvegardée, examens blancs et certificats de compétences pour le BTS Audiovisuel option Son.",
};

export default function SignupPage() {
  return <AuthForm mode="signup" />;
}
