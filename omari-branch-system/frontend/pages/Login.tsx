import React, { useState } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    // TODO: Implement authentication logic
    setTimeout(() => {
      setLoading(false);
      if (!username || !password) {
        setError("Username and password are required.");
      } else {
        // Simulate login success
        window.location.href = "/";
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 to-blue-100 px-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 flex flex-col items-center">
        <img
          src={require("../assets/logo.png")}
          alt="Omari Logo"
          className="h-16 mb-6"
        />
        <h1 className="text-2xl font-bold mb-2 text-slate-800">Sign in to Omari Branch System</h1>
        <p className="mb-6 text-slate-500 text-sm">Enter your credentials to continue</p>
        <form className="w-full space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
            <input
              type="text"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-green-200 focus:border-green-400"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="text-red-600 text-sm">{error}</div>}
          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-md transition"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
