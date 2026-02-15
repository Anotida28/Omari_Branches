import { FormEvent, useState } from "react";
import { KeyRound } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Card } from "../components/ui/Card";
import { useApiKey } from "../hooks/useApiKey";

export default function ApiKeyPage() {
  const { setApiKey } = useApiKey();
  const navigate = useNavigate();

  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalized = value.trim();
    if (!normalized) {
      setError("API key is required.");
      return;
    }

    setApiKey(normalized);
    navigate("/", { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <Card className="w-full max-w-md p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="rounded-md bg-slate-900 p-2 text-white">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Omari Branch System</p>
            <h1 className="text-lg font-semibold text-slate-900">Enter API Key</h1>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="mb-1 block text-sm font-medium text-slate-700">
              API Key
            </label>
            <input
              id="apiKey"
              type="password"
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              placeholder="Paste your API key"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            />
            {error ? <p className="mt-1 text-sm text-rose-600">{error}</p> : null}
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue
          </button>
        </form>
      </Card>
    </div>
  );
}
