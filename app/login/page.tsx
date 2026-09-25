import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getMe()) redirect("/");
  return <AuthForm />;
}
