import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import { getApiUrl } from "../utils/api";

export default function Register() {
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    const name = e.target.name.value;
    const email = e.target.email.value;
    const password = e.target.password.value;

    try {
      const res = await fetch(getApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name, email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("user_id", data.user.id);
        toast.success("Registration successful! Redirecting to dashboard...");
        
        // Redirect based on role returned from backend
        setTimeout(() => {
          if (data.user.role === "ADMIN") navigate("/admin");
          else if (data.user.role === "MANAGER") navigate("/manager");
          else navigate("/employee");
        }, 1500);
      } else {
        toast.error(data.message || "Registration failed.");
      }
    } catch {
      toast.error("Failed to connect to server");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-blue-50/50 relative overflow-hidden">
      {/* Aesthetic Light Background */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob"></div>
      <div className="absolute top-10 right-10 w-96 h-96 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
      <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-50 animate-blob animation-delay-4000"></div>

      <div className="w-full max-w-md p-10 bg-white/70 backdrop-blur-2xl border border-white rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative z-10 mx-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Create Account</h1>
          <p className="text-gray-500 mt-2 font-medium">Join us and start managing tasks</p>
        </div>

        <form onSubmit={handleRegister} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Full Name</label>
            <input name="name" type="text" required className="w-full px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none shadow-sm" placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Email Address</label>
            <input name="email" type="email" required className="w-full px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none shadow-sm" placeholder="you@company.com" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-gray-700">Password</label>
            <input name="password" type="password" required className="w-full px-5 py-3 rounded-2xl bg-white border border-gray-200 text-gray-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all outline-none shadow-sm" placeholder="••••••••" />
          </div>
          <button className="w-full py-4 mt-2 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-bold text-lg transition-all shadow-[0_10px_20px_rgba(37,99,235,0.2)] hover:shadow-[0_10px_25px_rgba(37,99,235,0.4)]">
            Register
          </button>
        </form>
        <p className="mt-8 text-center text-gray-500 font-medium">Already have an account? <Link to="/login" className="text-blue-600 hover:underline hover:text-blue-800 font-bold">Log in</Link></p>
      </div>
    </div>
  );
}
