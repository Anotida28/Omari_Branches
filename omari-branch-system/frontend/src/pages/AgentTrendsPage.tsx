import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { RefreshCw, Search, UserRound, X } from "lucide-react";

import { chartPalette, glassPanelSx } from "../app/theme";
import { fetchAgentTrends, fetchAllAgents } from "../services/agents";
import { formatCurrency } from "../services/format";
import { StatCard } from "../shared/components/StatCard";
import { StatCardSkeleton } from "../shared/components/StatCardSkeleton";
import { ChartSkeleton } from "../shared/components/ChartSkeleton";
import type { AgentSearchResult } from "../types/api";

function formatCompactCurrency(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDateLabel(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", timeZone: "UTC" }).format(d);
}

type ChartMode = "line" | "bar";

function ChartModeToggle({ mode, onChange }: { mode: ChartMode; onChange: (m: ChartMode) => void }) {
  return (
    <ButtonGroup size="small" variant="outlined">
      <Button variant={mode === "line" ? "contained" : "outlined"} onClick={() => onChange("line")}>Line</Button>
      <Button variant={mode === "bar" ? "contained" : "outlined"} onClick={() => onChange("bar")}>Bar</Button>
    </ButtonGroup>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2.2, ...glassPanelSx }}>
      <Box sx={{ mb: 1.3 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>
      {children}
    </Paper>
  );
}

function ChartEmpty() {
  return (
    <Box sx={{ height: 260, borderRadius: 2, border: "1px dashed rgba(16,32,23,0.22)", display: "grid", placeItems: "center", color: "text.secondary" }}>
      <Typography variant="body2">No data for selected agents and date range.</Typography>
    </Box>
  );
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AgentTrendsPage() {
  const today = toInputDate(new Date());
  const sixtyDaysAgo = toInputDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));

  const [dateFrom, setDateFrom] = useState(sixtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);
  const [cashMode, setCashMode] = useState<ChartMode>("line");
  const [commissionMode, setCommissionMode] = useState<ChartMode>("line");
  const [volumeMode, setVolumeMode] = useState<ChartMode>("bar");

  const queryClient = useQueryClient();

  // Agent search
  const [inputValue, setInputValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedAgents, setSelectedAgents] = useState<AgentSearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load all agents once — cached for 1 hour on both backend and frontend
  const allAgentsQuery = useQuery({
    queryKey: ["agents-list"],
    queryFn: fetchAllAgents,
    staleTime: 60 * 60 * 1000,
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedAccounts = selectedAgents.map((a) => a.agentAccount);

  const trendsQuery = useQuery({
    queryKey: ["agent-trends", selectedAccounts.join(","), dateFrom, dateTo],
    queryFn: () => fetchAgentTrends({ agentAccounts: selectedAccounts, dateFrom, dateTo }),
    enabled: selectedAccounts.length > 0,
  });

  function addAgent(agent: AgentSearchResult) {
    if (!selectedAccounts.includes(agent.agentAccount)) {
      setSelectedAgents((prev) => [...prev, agent]);
    }
    setInputValue("");
    setDropdownOpen(false);
  }

  function removeAgent(account: string) {
    setSelectedAgents((prev) => prev.filter((a) => a.agentAccount !== account));
  }

  function clearAll() {
    setSelectedAgents([]);
    setInputValue("");
  }

  function resetDates() {
    setDateFrom(sixtyDaysAgo);
    setDateTo(today);
  }

  // Client-side filtering — instant, no DB round-trip per keystroke
  const dropdownResults = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    if (term.length < 1 || !allAgentsQuery.data) return [];
    return allAgentsQuery.data
      .filter(
        (a) =>
          !selectedAccounts.includes(a.agentAccount) &&
          (a.fullName?.toLowerCase().includes(term) ||
            a.agentAccount.toLowerCase().includes(term) ||
            a.mobileNumber?.toLowerCase().includes(term)),
      )
      .slice(0, 30);
  }, [allAgentsQuery.data, inputValue, selectedAccounts]);

  const trend = trendsQuery.data?.trend ?? [];
  const kpis = trendsQuery.data?.kpis;
  const isLoadingTrends = trendsQuery.isLoading && selectedAccounts.length > 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Agent Trends</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Search for agents across the country, select one or build a group to view combined trends.
          </Typography>
        </Box>
      </Stack>

      {/* Search + date filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
        <Stack spacing={2}>
          {/* Agent search input */}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems="flex-start">
            <Box ref={containerRef} sx={{ position: "relative", flex: 1, minWidth: 0 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by agent name or account number…"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  setDropdownOpen(true);
                }}
                onFocus={() => {
                  if (inputValue.trim().length >= 1) setDropdownOpen(true);
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {allAgentsQuery.isLoading ? (
                        <CircularProgress size={14} />
                      ) : (
                        <Search size={15} />
                      )}
                    </InputAdornment>
                  ),
                }}
              />

              {/* Dropdown results */}
              {dropdownOpen && inputValue.trim().length >= 1 && (
                <Paper
                  elevation={4}
                  sx={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    maxHeight: 280,
                    overflowY: "auto",
                    mt: 0.5,
                    borderRadius: 1.5,
                  }}
                >
                  {allAgentsQuery.isLoading ? (
                    <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
                      <CircularProgress size={14} />
                      <Typography variant="body2" color="text.secondary">Loading agents…</Typography>
                    </Box>
                  ) : dropdownResults.length === 0 ? (
                    <Box sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary">No agents found for "{inputValue}"</Typography>
                    </Box>
                  ) : (
                    dropdownResults.map((agent) => (
                      <Box
                        key={agent.agentAccount}
                        onClick={() => addAgent(agent)}
                        sx={{
                          px: 2,
                          py: 1.2,
                          cursor: "pointer",
                          borderBottom: "1px solid rgba(0,0,0,0.06)",
                          "&:last-child": { borderBottom: "none" },
                          "&:hover": { bgcolor: "rgba(12,95,63,0.07)" },
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <UserRound size={14} style={{ flexShrink: 0, color: "#6b7280" }} />
                          <Box>
                            <Typography variant="body2" fontWeight={600} lineHeight={1.3}>
                              {agent.fullName ?? agent.agentAccount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {agent.agentAccount}
                              {agent.mobileNumber ? ` · ${agent.mobileNumber}` : ""}
                            </Typography>
                          </Box>
                        </Stack>
                      </Box>
                    ))
                  )}
                </Paper>
              )}
            </Box>

            <TextField
              label="From"
              type="date"
              size="small"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150 }}
            />
            <Button variant="outlined" size="small" onClick={resetDates} sx={{ whiteSpace: "nowrap", height: 40 }}>
              Reset Dates
            </Button>
            {!allAgentsQuery.isLoading && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["agents-list"] })}
                disabled={allAgentsQuery.isFetching}
                startIcon={
                  allAgentsQuery.isFetching
                    ? <CircularProgress size={13} />
                    : <RefreshCw size={13} />
                }
                sx={{ whiteSpace: "nowrap", height: 40 }}
                title="Refresh agents list — use this if new agents have been added"
              >
                Refresh Agents
              </Button>
            )}
          </Stack>

          {/* Selected agent chips */}
          {selectedAgents.length > 0 && (
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                {selectedAgents.length === 1 ? "1 agent selected" : `${selectedAgents.length} agents — viewing as a group`}:
              </Typography>
              {selectedAgents.map((agent) => (
                <Chip
                  key={agent.agentAccount}
                  icon={<UserRound size={12} />}
                  label={agent.fullName ?? agent.agentAccount}
                  size="small"
                  onDelete={() => removeAgent(agent.agentAccount)}
                  deleteIcon={<X size={12} />}
                  color="primary"
                  variant="outlined"
                />
              ))}
              <Button size="small" color="inherit" onClick={clearAll} sx={{ ml: 0.5, fontSize: 12 }}>
                Clear all
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>

      {/* Empty state */}
      {selectedAgents.length === 0 && (
        <Paper
          variant="outlined"
          sx={{ p: 6, borderRadius: 2, textAlign: "center", borderStyle: "dashed" }}
        >
          <UserRound size={40} style={{ color: "#9ca3af", margin: "0 auto 12px" }} />
          <Typography variant="h6" fontWeight={600} color="text.secondary">No agents selected</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Search for an agent above to view their trends. Add multiple agents to combine them into a group.
          </Typography>
        </Paper>
      )}

      {/* KPIs */}
      {selectedAgents.length > 0 && (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              mb: 2,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", xl: "repeat(4, 1fr)" },
            }}
          >
            {isLoadingTrends ? (
              Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  label="Transaction Value"
                  value={kpis ? formatCurrency(kpis.totalTransactionValue) : "—"}
                  hint="Cash in + cash out"
                />
                <StatCard
                  label="Total Commission"
                  value={kpis ? formatCurrency(kpis.totalCommission) : "—"}
                  hint="Deposits + withdrawals commission"
                />
                <StatCard
                  label="Transaction Volume"
                  value={kpis ? kpis.totalTransactionVolume.toLocaleString() : "—"}
                  hint="Total transactions"
                />
                <StatCard
                  label={selectedAgents.length === 1 ? "Agent" : "Group Size"}
                  value={selectedAgents.length === 1
                    ? (selectedAgents[0].fullName ?? selectedAgents[0].agentAccount)
                    : `${selectedAgents.length} agents`
                  }
                  hint={`${dateFrom} – ${dateTo}`}
                />
              </>
            )}
          </Box>

          {/* Charts */}
          {isLoadingTrends ? (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "repeat(2, 1fr)" } }}>
              <ChartSkeleton height={260} />
              <ChartSkeleton height={260} />
              <ChartSkeleton height={260} />
            </Box>
          ) : (
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "repeat(2, 1fr)" } }}>
              {/* Cash In / Out */}
              <ChartCard
                title="Cash In / Cash Out Value"
                subtitle="Daily deposit and withdrawal values over the selected period"
              >
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={cashMode} onChange={setCashMode} />
                </Stack>
                {trend.length === 0 ? <ChartEmpty /> : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {cashMode === "line" ? (
                        <ComposedChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis tickFormatter={formatCompactCurrency} />
                          <Tooltip
                            formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                            labelFormatter={(l) => formatDateLabel(String(l))}
                          />
                          <Legend />
                          <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                          <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                          <Line type="monotone" dataKey="totalTransactionValue" stroke={chartPalette.primary} strokeWidth={2} dot={false} name="Total Value" />
                        </ComposedChart>
                      ) : (
                        <BarChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis tickFormatter={formatCompactCurrency} />
                          <Tooltip
                            formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                            labelFormatter={(l) => formatDateLabel(String(l))}
                          />
                          <Legend />
                          <Bar dataKey="cashInValue" fill={chartPalette.secondary} name="Cash In" />
                          <Bar dataKey="cashOutValue" fill={chartPalette.warning} name="Cash Out" />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </Box>
                )}
              </ChartCard>

              {/* Commission */}
              <ChartCard
                title="Commission Trend"
                subtitle="Daily total commission earned over the selected period"
              >
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={commissionMode} onChange={setCommissionMode} />
                </Stack>
                {trend.length === 0 ? <ChartEmpty /> : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {commissionMode === "line" ? (
                        <LineChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis tickFormatter={formatCompactCurrency} />
                          <Tooltip
                            formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                            labelFormatter={(l) => formatDateLabel(String(l))}
                          />
                          <Line type="monotone" dataKey="totalCommission" stroke={chartPalette.tertiary} strokeWidth={2} dot={false} name="Commission" />
                        </LineChart>
                      ) : (
                        <BarChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis tickFormatter={formatCompactCurrency} />
                          <Tooltip
                            formatter={(v: number | string | undefined) => formatCurrency(Number(v ?? 0))}
                            labelFormatter={(l) => formatDateLabel(String(l))}
                          />
                          <Bar dataKey="totalCommission" fill={chartPalette.tertiary} name="Commission" />
                        </BarChart>
                      )}
                    </ResponsiveContainer>
                  </Box>
                )}
              </ChartCard>

              {/* Transaction Volume */}
              <ChartCard
                title="Transaction Volume"
                subtitle="Daily number of deposits and withdrawals"
              >
                <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                  <ChartModeToggle mode={volumeMode} onChange={setVolumeMode} />
                </Stack>
                {trend.length === 0 ? <ChartEmpty /> : (
                  <Box sx={{ height: 260 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      {volumeMode === "bar" ? (
                        <BarChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis />
                          <Tooltip labelFormatter={(l) => formatDateLabel(String(l))} />
                          <Legend />
                          <Bar dataKey="cashInVolume" fill={chartPalette.secondary} name="Deposits" />
                          <Bar dataKey="cashOutVolume" fill={chartPalette.warning} name="Withdrawals" />
                        </BarChart>
                      ) : (
                        <LineChart data={trend}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartPalette.mutedGrid} />
                          <XAxis dataKey="date" tickFormatter={formatDateLabel} />
                          <YAxis />
                          <Tooltip labelFormatter={(l) => formatDateLabel(String(l))} />
                          <Legend />
                          <Line type="monotone" dataKey="cashInVolume" stroke={chartPalette.secondary} strokeWidth={2} dot={false} name="Deposits" />
                          <Line type="monotone" dataKey="cashOutVolume" stroke={chartPalette.warning} strokeWidth={2} dot={false} name="Withdrawals" />
                        </LineChart>
                      )}
                    </ResponsiveContainer>
                  </Box>
                )}
              </ChartCard>

              {/* Recent daily detail */}
              {trend.length > 0 && (
                <Paper sx={{ p: 2.2, ...glassPanelSx }}>
                  <Typography variant="subtitle1" fontWeight={700} mb={1.5}>Recent Daily Detail</Typography>
                  <Stack spacing={0.8}>
                    <Divider />
                    {trend.slice(-10).reverse().map((point) => (
                      <Box key={point.date}>
                        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={0.5} py={0.8}>
                          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 80 }}>
                            {formatDateLabel(point.date)}
                          </Typography>
                          <Stack direction="row" gap={2} flexWrap="wrap">
                            <Typography variant="body2" color="text.secondary">
                              In: <strong style={{ color: "#1e7d4c" }}>{formatCurrency(point.cashInValue)}</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Out: <strong style={{ color: "#b45309" }}>{formatCurrency(point.cashOutValue)}</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Commission: <strong>{formatCurrency(point.totalCommission)}</strong>
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Vol: <strong>{point.totalTransactionVolume.toLocaleString()}</strong>
                            </Typography>
                          </Stack>
                        </Stack>
                        <Divider />
                      </Box>
                    ))}
                  </Stack>
                </Paper>
              )}
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
