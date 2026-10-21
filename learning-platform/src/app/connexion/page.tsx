import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Connectez-vous à votre portail Tech Nest : progression, examens et certificats.",
};

export default function LoginPage() {
  return <AuthForm mode="login" />;
}
