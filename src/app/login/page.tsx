"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");

  // Login state
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupName, setSignupName] = useState("");
  const [signupUserName, setSignupUserName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [signupError, setSignupError] = useState("");
  const [signupMessage, setSignupMessage] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setLoginError("");
    setSignupError("");
    setSignupMessage("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    const result = await signIn("credentials", { userName, password, redirect: false });
    setLoginLoading(false);
    if (result?.error) {
      setLoginError("Invalid username or password, or your account is not yet active.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    setSignupMessage("");

    if (signupPassword !== signupConfirm) {
      setSignupError("Passwords do not match.");
      return;
    }
    if (signupPassword.length < 6) {
      setSignupError("Password must be at least 6 characters.");
      return;
    }

    setSignupLoading(true);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: signupName, userName: signupUserName, email: signupEmail, password: signupPassword }),
    });
    const data = await res.json();
    setSignupLoading(false);

    if (!res.ok) {
      setSignupError(data.error || "Failed to create account.");
      return;
    }

    setSignupMessage(data.message || "Account created. An administrator must activate your account before you can sign in.");
    setSignupName("");
    setSignupUserName("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirm("");
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

        <div className="mb-4 grid grid-cols-2 rounded-lg border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => switchMode("signup")}
            className={`rounded-md py-2 text-sm font-medium transition-colors ${
              mode === "signup" ? "bg-blue-600 text-white" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Sign Up
          </button>
        </div>

        {mode === "login" ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Enter your credentials to access the system</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userName">Username</Label>
                  <Input
                    id="userName"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                {loginError && (
                  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{loginError}</div>
                )}
                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Create an account</CardTitle>
              <CardDescription>An administrator must activate your account before you can sign in.</CardDescription>
            </CardHeader>
            <CardContent>
              {signupMessage ? (
                <div className="space-y-4">
                  <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">{signupMessage}</div>
                  <Button type="button" className="w-full" variant="outline" onClick={() => switchMode("login")}>
                    Back to Log In
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signupName">Full Name</Label>
                    <Input
                      id="signupName"
                      value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupUserName">Username</Label>
                    <Input
                      id="signupUserName"
                      value={signupUserName}
                      onChange={(e) => setSignupUserName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupEmail">Email</Label>
                    <Input
                      id="signupEmail"
                      type="email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupPassword">Password</Label>
                    <Input
                      id="signupPassword"
                      type="password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signupConfirm">Confirm Password</Label>
                    <Input
                      id="signupConfirm"
                      type="password"
                      value={signupConfirm}
                      onChange={(e) => setSignupConfirm(e.target.value)}
                      required
                    />
                  </div>
                  {signupError && (
                    <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{signupError}</div>
                  )}
                  <Button type="submit" className="w-full" disabled={signupLoading}>
                    {signupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create Account
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
