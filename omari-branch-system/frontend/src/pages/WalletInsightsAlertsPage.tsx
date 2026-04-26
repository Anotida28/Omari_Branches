import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Info, ShieldAlert, TrendingUp } from "lucide-react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { glassPanelSx } from "../app/theme";
import { getErrorMessage } from "../services/api";
import { formatCurrency, formatDate } from "../services/format";
import { fetchWalletInsightsAlerts } from "../services/wallet";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";
import type { WalletInsightAlertItem, WalletInsightAlertSeverity } from "../types/api";

function toInputDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatMetric(alert: WalletInsightAlertItem): string {
  if (alert.category === "revenue" || alert.category === "liquidity" || alert.category === "growth" || alert.category === "activity" || alert.category === "dormancy") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(alert.metricValue)}%`;
  }
  if (alert.category === "cash_flow") {
    return formatCurrency(alert.metricValue);
  }
  return formatCount(alert.metricValue);
}

const presets = [
  {
    label: "Last 30",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -29)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "Last 60",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -59)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "Last 90",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -89)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "MTD",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(startOfMonth(today)), dateTo: toInputDate(today) };
    },
  },
];

const severityConfig: Record<WalletInsightAlertSeverity, {
  color: "error" | "warning" | "success" | "info";
  icon: JSX.Element;
  label: string;
}> = {
  critical: { color: "error", icon: <ShieldAlert size={18} />, label: "Critical" },
  warning: { color: "warning", icon: <AlertTriangle size={18} />, label: "Warning" },
  positive: { color: "success", icon: <CheckCircle2 size={18} />, label: "Positive" },
  info: { color: "info", icon: <Info size={18} />, label: "Info" },
};

export default function WalletInsightsAlertsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -29));
  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        next.delete(key);
        return;
      }
      next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  };

  const insightsQuery = useQuery({
    queryKey: ["wallet", "insights-alerts", { dateFrom, dateTo }],
    queryFn: () => fetchWalletInsightsAlerts({ dateFrom, dateTo, asOfDate: dateTo }),
  });

  return (
    <section className="space-y-5 motion-fade-up">
      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }}>
          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            {presets.map((preset) => (
              <Button key={preset.label} onClick={() => updateParams(preset.getRange())}>
                {preset.label}
              </Button>
            ))}
          </ButtonGroup>
          <TextField
            type="date"
            label="Date From"
            value={dateFrom}
            onChange={(event) => updateParams({ dateFrom: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />
          <TextField
            type="date"
            label="Date To"
            value={dateTo}
            onChange={(event) => updateParams({ dateTo: event.target.value || undefined })}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: "100%", lg: 170 } }}
          />
          <Button
            variant="outlined"
            onClick={() => setSearchParams({}, { replace: true })}
            sx={{ width: { xs: "100%", lg: "auto" }, whiteSpace: "nowrap" }}
          >
            Reset Filters
          </Button>
        </Stack>
      </FilterBar>

      {insightsQuery.isError ? <Alert severity="error">{getErrorMessage(insightsQuery.error)}</Alert> : null}

      {insightsQuery.isLoading ? (
        <Alert severity="info">Loading insights and alerts...</Alert>
      ) : insightsQuery.data ? (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: {
                xs: "1fr",
                md: "repeat(2, minmax(0, 1fr))",
                xl: "repeat(4, minmax(0, 1fr))",
              },
            }}
          >
            <StatCard label="Critical" value={formatCount(insightsQuery.data.summary.criticalCount)} icon={<ShieldAlert size={20} />} />
            <StatCard label="Warnings" value={formatCount(insightsQuery.data.summary.warningCount)} icon={<AlertTriangle size={20} />} />
            <StatCard label="Positive" value={formatCount(insightsQuery.data.summary.positiveCount)} icon={<CheckCircle2 size={20} />} />
            <StatCard label="Total Alerts" value={formatCount(insightsQuery.data.summary.totalAlerts)} icon={<TrendingUp size={20} />} />
          </Box>

          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" } }}>
            {insightsQuery.data.alerts.map((alert) => {
              const config = severityConfig[alert.severity];
              return (
                <Paper key={alert.id} sx={{ p: 2.2, ...glassPanelSx }}>
                  <Stack spacing={1.4}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        {config.icon}
                        <Typography variant="subtitle1" fontWeight={800}>{alert.title}</Typography>
                      </Stack>
                      <Chip label={config.label} color={config.color} size="small" variant="outlined" />
                    </Stack>
                    <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
                      <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                        <Typography variant="caption" color="text.secondary">{alert.metricLabel}</Typography>
                        <Typography variant="h6" fontWeight={800}>{formatMetric(alert)}</Typography>
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 1.2, borderColor: "rgba(15, 23, 42, 0.08)" }}>
                        <Typography variant="caption" color="text.secondary">Threshold</Typography>
                        <Typography variant="h6" fontWeight={800}>{alert.thresholdLabel}</Typography>
                      </Paper>
                    </Box>
                    <Typography variant="body2" color="text.secondary">{alert.message}</Typography>
                    <Alert severity={config.color} variant="outlined">
                      {alert.suggestedAction}
                    </Alert>
                  </Stack>
                </Paper>
              );
            })}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            Period: {formatDate(insightsQuery.data.period.dateFrom)} to {formatDate(insightsQuery.data.period.dateTo)}.
            Freshness: {new Date(insightsQuery.data.metadata.dataFreshnessTimestamp).toLocaleString("en-US")}.
          </Alert>
        </>
      ) : null}
    </section>
  );
}
