"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label, Input, Button, Alert } from "@/components/ui/Field";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Código inválido");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    const res = await fetch("/api/auth/resend-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 429) {
      setCooldown(data.retryAfter ?? 60);
      setError(`Espera ${data.retryAfter ?? 60}s para reenviar`);
      return;
    }
    setCooldown(60);
    setNotice("Te enviamos un nuevo código.");
  }

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold">Verifica tu cuenta</h2>
      <p className="mb-5 text-sm text-muted">
        Enviamos un código de 6 dígitos a <span className="font-medium">{email}</span>.
      </p>
      {error && <Alert kind="error">{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label htmlFor="code">Código</Label>
          <Input
            id="code"
            inputMode="numeric"
            maxLength={6}
            required
            placeholder="000000"
            className="text-center text-lg tracking-[0.5em]"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
        </div>
        <Button type="submit" loading={loading}>
          Verificar
        </Button>
      </form>
      <div className="mt-4 text-center text-sm">
        <button
          onClick={resend}
          disabled={cooldown > 0}
          className="text-brand hover:underline disabled:opacity-50"
        >
          {cooldown > 0 ? `Reenviar código (${cooldown}s)` : "Reenviar código"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Cargando…</p>}>
      <VerifyForm />
    </Suspense>
  );
}
