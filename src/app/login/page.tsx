"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_ACCOUNTS = [
  { label: "Admin", email: "admin@recruitpro.com", password: "admin123", color: "bg-purple-600 hover:bg-purple-700 text-white" },
  { label: "HR", email: "hr@recruitpro.com", password: "hr123", color: "bg-blue-600 hover:bg-blue-700 text-white" },
  { label: "Branch Mgr", email: "bm@recruitpro.com", password: "bm123", color: "bg-green-600 hover:bg-green-700 text-white" },
  { label: "Div. Manager", email: "dm@recruitpro.com", password: "dm123", color: "bg-yellow-600 hover:bg-yellow-700 text-white" },
  { label: "Candidate", email: "candidate@recruitpro.com", password: "candidate123", color: "bg-gray-600 hover:bg-gray-700 text-white" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState<string | null>(null);

  const doLogin = async (loginEmail: string, loginPassword: string) => {
    setError("");
    const result = await signIn("credentials", {
      email: loginEmail,
      password: loginPassword,
      redirect: false,
    });
    if (result?.error) {
      setError("Invalid email or password.");
      return false;
    }
    router.push("/dashboard");
    router.refresh();
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await doLogin(email, password);
    setLoading(false);
  };

  const handleQuickLogin = async (account: typeof QUICK_ACCOUNTS[0]) => {
    setQuickLoading(account.label);
    await doLogin(account.email, account.password);
    setQuickLoading(null);
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="rounded-xl bg-blue-600 p-2">
            <Globe className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RecruitPro ERP</h1>
            <p className="text-sm text-gray-500">Recruitment Management System</p>
          </div>
        </div>

        {/* Quick Access */}
        <Card className="mb-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-700">Quick Access</CardTitle>
            <CardDescription className="text-xs">Click a role to log in instantly with demo credentials</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {QUICK_ACCOUNTS.map((account) => (
                <button
                  key={account.label}
                  onClick={() => handleQuickLogin(account)}
                  disabled={!!quickLoading || loading}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors disabled:opacity-60 ${account.color}`}
                >
                  {quickLoading === account.label && <Loader2 className="h-3 w-3 animate-spin" />}
                  {account.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>
              )}
              <Button type="submit" className="w-full" disabled={loading || !!quickLoading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
