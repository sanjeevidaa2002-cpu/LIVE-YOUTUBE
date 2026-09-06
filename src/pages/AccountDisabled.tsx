import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function AccountDisabled() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <ShieldAlert className="h-14 w-14 text-destructive" />
      <h1 className="text-2xl font-bold">Account Deactivated</h1>
      <p className="max-w-sm text-muted-foreground">
        Your account has been deactivated by an administrator. Please contact support if you
        believe this is a mistake.
      </p>
      <Button onClick={handleSignOut}>Sign Out</Button>
    </div>
  );
}
