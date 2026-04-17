import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../utils/api";

export default function PublicOnlyRoute({ children }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    apiFetch("/api/auth/me")
      .then(async (res) => {
        if (!active) return;

        if (!res.ok) {
          setChecking(false);
          return;
        }

        const data = await res.json();
        const role = data?.user?.role;

        if (role === "ADMIN") navigate("/admin", { replace: true });
        else if (role === "MANAGER") navigate("/manager", { replace: true });
        else navigate("/employee", { replace: true });
      })
      .catch(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [navigate]);

  if (checking) return <div className="min-h-screen bg-slate-50" />;

  return children;
}
