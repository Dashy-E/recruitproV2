"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Profile {
  id: string;
  name: string;
  userName: string;
  email: string;
  role: string;
  roleLabel: string;
  isActive: boolean;
  signatureUrl: string | null;
  createdAt: string;
  orgUnits: { id: string; name: string; path: string }[];
  departmentName: string | null;
}

export default function ProfilePage() {
  const { update: updateSession } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [signatureError, setSignatureError] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const fetchProfile = () => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d: Profile) => {
        setProfile(d);
        setName(d.name);
        setEmail(d.email);
        setSignaturePreview(d.signatureUrl);
        setLoading(false);
      });
  };

  useEffect(() => { fetchProfile(); }, []);

  const passwordsMatch = password === confirmPassword;

  const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSignatureError("");
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setSignatureError("Only PNG, JPG, or JPEG files are accepted.");
      e.target.value = "";
      return;
    }
    setSignatureFile(file);
    setSignaturePreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setError("");
    setSuccess(false);
    setSaving(true);

    const payload: Record<string, unknown> = { name, email };
    if (password) payload.password = password;

    const requests: Promise<Response>[] = [
      fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ];
    if (signatureFile) {
      const fd = new FormData();
      fd.append("file", signatureFile);
      requests.push(fetch(`/api/users/${profile!.id}/signature`, { method: "POST", body: fd }));
    }

    const [res] = await Promise.all(requests);
    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update profile.");
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setSignatureFile(null);
    setSuccess(true);
    fetchProfile();
    // The sidebar/topbar show name/email from the session — refresh it so a
    // name change reflects immediately without needing to log out/in.
    updateSession();
  };

  if (loading || !profile) {
    return <div className="py-20 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <User className="h-6 w-6 text-blue-600" /> My Profile
        </h2>
        <p className="text-sm text-gray-500 mt-1">Update your personal details, password, and signature.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Personal Details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Full Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Email *</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Username</Label>
            <Input value={profile.userName} readOnly className="bg-gray-50 cursor-not-allowed" />
          </div>
          <div className="space-y-1">
            <Label>Role</Label>
            <Input value={profile.roleLabel} readOnly className="bg-gray-50 cursor-not-allowed" />
          </div>

          {profile.departmentName && (
            <div className="space-y-1">
              <Label>Department</Label>
              <Input value={profile.departmentName} readOnly className="bg-gray-50 cursor-not-allowed" />
            </div>
          )}
          <div className="space-y-1">
            <Label>Account Status</Label>
            <div>
              <Badge variant={profile.isActive ? "success" : "secondary"}>
                {profile.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>

          <div className="col-span-2 space-y-1">
            <Label>Org Units</Label>
            {profile.orgUnits.length === 0 ? (
              <p className="text-sm text-gray-400">None assigned</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {profile.orgUnits.map((o) => (
                  <Badge key={o.id} variant="outline">{o.path || o.name}</Badge>
                ))}
              </div>
            )}
          </div>

          <p className="col-span-2 text-xs text-gray-400 border-t pt-3">
            Username, role, department, org units, and account status are managed by an administrator and can't be changed here. Member since {formatDate(profile.createdAt)}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>New Password</Label>
            <Input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" />
          </div>
          <div className="space-y-1">
            <Label>Confirm Password</Label>
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            {confirmPassword && !passwordsMatch && <p className="text-xs text-red-500">Passwords do not match.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Signature</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-gray-500">PNG, JPG, or JPEG only. Used on printed documents where your signature is required.</p>
          <div className="flex items-center gap-4">
            {signaturePreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signaturePreview} alt="Signature preview" className="h-16 border border-gray-200 rounded bg-white object-contain px-2" />
            ) : (
              <div className="h-16 w-32 flex items-center justify-center border border-dashed border-gray-300 rounded text-xs text-gray-400">
                No signature
              </div>
            )}
            <Input type="file" accept="image/png,image/jpeg" onChange={handleSignatureFileChange} className="max-w-xs" />
          </div>
          {signatureError && <p className="text-xs text-red-500">{signatureError}</p>}
        </CardContent>
      </Card>

      {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      {success && <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">Profile updated successfully.</div>}

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim() || !email.trim() || (!!password && (password.length < 6 || !passwordsMatch))}
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
