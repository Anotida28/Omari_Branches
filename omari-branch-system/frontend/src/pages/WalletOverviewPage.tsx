import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarClock,
  DollarSign,
  TrendingUp,
  UserPlus,
  Users,
  UserX,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { getErrorMessage } from "../services/api";
import { formatCurrency, formatDate } from "../services/format";
import { fetchWalletOverview } from "../services/wallet";
import { FilterBar } from "../shared/components/FilterBar";
import { StatCard } from "../shared/components/StatCard";

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

function startOfQuarter(date: Date): Date {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function formatCount(value: number | null): string {
  if (value === null) {
    return "Not available";
  }

  return new Intl.NumberFormat("en-US").format(value);
}

function formatDelta(absoluteChange: number, percentChange: number | null): string {
  const sign = absoluteChange > 0 ? "+" : "";
  const amount = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(absoluteChange);
  const pct = percentChange === null ? "n/a" : `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(1)}%`;
  return `${sign}${amount} (${pct}) vs previous period`;
}

type DatePreset = {
  label: string;
  getRange: () => { dateFrom: string; dateTo: string };
};

const datePresets: DatePreset[] = [
  {
    label: "Last 7",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(shiftDays(today, -6)), dateTo: toInputDate(today) };
    },
  },
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
    label: "MTD",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(startOfMonth(today)), dateTo: toInputDate(today) };
    },
  },
  {
    label: "QTD",
    getRange: () => {
      const today = new Date();
      return { dateFrom: toInputDate(startOfQuarter(today)), dateTo: toInputDate(today) };
    },
  },
];

export default function WalletOverviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDateTo = toInputDate(new Date());
  const initialDateFrom = toInputDate(shiftDays(new Date(), -29));

  const dateFrom = searchParams.get("dateFrom") ?? initialDateFrom;
  const dateTo = searchParams.get("dateTo") ?? initialDateTo;
  const compare = searchParams.get("compare") !== "false";
  const currency = (searchParams.get("currency") ?? "USD") as "USD" | "ZWL";

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

  const walletQuery = useQuery({
    queryKey: ["wallet", "overview", { dateFrom, dateTo, compare, currency }],
    queryFn: () =>
      fetchWalletOverview({
        dateFrom,
        dateTo,
        asOfDate: dateTo,
        compare,
        currency,
      }),
  });

  const insights = useMemo(() => {
    const comparison = walletQuery.data?.comparison?.kpis;
    if (!comparison) {
      return [];
    }

    const items: Array<{ severity: "warning" | "error" | "info"; message: string }> = [];

    if ((comparison.totalTransactionValue.percentChange ?? 0) < -10) {
      items.push({
        severity: "warning",
        message: "Growth warning: transaction value is down more than 10% versus the previous period.",
      });
    }

    if ((comparison.activeCustomersA30.percentChange ?? 0) < -8) {
      items.push({
        severity: "warning",
        message: "Activity warning: active customers A30 is down more than 8%.",
      });
    }

    if (
      comparison.newCustomers.absoluteChange > 0 &&
      comparison.activeCustomersA30.absoluteChange <= 0
    ) {
      items.push({
        severity: "info",
        message: "Activation gap: new customers increased, but A30 activity did not improve.",
      });
    }

    if ((comparison.dormantCustomers90Plus?.percentChange ?? 0) > 5) {
      items.push({
        severity: "warning",
        message: "Dormancy risk: 90+ day dormant customers are up more than 5%.",
      });
    }

    if ((comparison.latestTotalEFloat.percentChange ?? 0) < -15) {
      items.push({
        severity: "error",
        message: "Liquidity risk: latest total e-float is down more than 15% versus the previous snapshot period.",
      });
    }

    return items;
  }, [walletQuery.data]);

  const cards = useMemo(() => {
    if (!walletQuery.data) {
      return [];
    }

    const comparison = walletQuery.data.comparison?.kpis;
    const comparisonHint = (key: keyof NonNullable<typeof comparison>) => {
      const delta = comparison?.[key];
      if (!delta) {
        return undefined;
      }
      return formatDelta(delta.absoluteChange, delta.percentChange);
    };

    return [
      {
        label: "Total Transaction Value",
        value: formatCurrency(walletQuery.data.kpis.totalTransactionValue),
        hint: comparisonHint("totalTransactionValue"),
        icon: <DollarSign size={20} />,
      },
      {
        label: "Total Transaction Volume",
        value: formatCount(walletQuery.data.kpis.totalTransactionVolume),
        hint: comparisonHint("totalTransactionVolume"),
        icon: <Activity size={20} />,
      },
      {
        label: "Total Commission",
        value: formatCurrency(walletQuery.data.kpis.totalCommission),
        hint: comparisonHint("totalCommission"),
        icon: <TrendingUp size={20} />,
      },
      {
        label: "Active Customers A30",
        value: formatCount(walletQuery.data.kpis.activeCustomersA30),
        hint: comparisonHint("activeCustomersA30"),
        icon: <Users size={20} />,
      },
      {
        label: "Active Customers A60",
        value: formatCount(walletQuery.data.kpis.activeCustomersA60),
        hint: comparisonHint("activeCustomersA60"),
        icon: <Users size={20} />,
      },
      {
        label: "New Customers",
        value: formatCount(walletQuery.data.kpis.newCustomers),
        hint: comparisonHint("newCustomers"),
        icon: <UserPlus size={20} />,
      },
      {
        label: "Dormant Customers (90+ days)",
        value: formatCount(walletQuery.data.kpis.dormantCustomers90Plus),
        hint: comparisonHint("dormantCustomers90Plus") ?? "Requires customer activity snapshot",
        icon: <UserX size={20} />,
      },
      {
        label: "Latest Total E-Float",
        value: formatCurrency(walletQuery.data.kpis.latestTotalEFloat),
        hint: walletQuery.data.kpis.latestEFloatDate
          ? `Snapshot: ${formatDate(walletQuery.data.kpis.latestEFloatDate)}`
          : "No balance snapshot available",
        icon: <Wallet size={20} />,
      },
    ];
  }, [walletQuery.data]);

  return (
    <section className="space-y-5 motion-fade-up">
      <FilterBar>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1.2} alignItems={{ xs: "stretch", lg: "center" }}>
          <ButtonGroup size="small" variant="outlined">
            {(["USD", "ZWL"] as const).map((c) => (
              <Button
                key={c}
                variant={currency === c ? "contained" : "outlined"}
                onClick={() => updateParams({ currency: c })}
              >
                {c}
              </Button>
            ))}
          </ButtonGroup>

          <ButtonGroup size="small" variant="outlined" sx={{ flexWrap: "wrap" }}>
            {datePresets.map((preset) => (
              <Button
                key={preset.label}
                onClick={() => updateParams(preset.getRange())}
                sx={{ whiteSpace: "nowrap" }}
              >
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

          <FormControlLabel
            control={
              <Switch
                checked={compare}
                onChange={(event) => updateParams({ compare: event.target.checked ? "true" : "false" })}
              />
            }
            label="Compare with previous period"
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

      {walletQuery.isError ? <Alert severity="error">{getErrorMessage(walletQuery.error)}</Alert> : null}

      {walletQuery.isLoading ? (
        <Alert severity="info">Loading wallet overview...</Alert>
      ) : walletQuery.data ? (
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
            {cards.map((card) => (
              <StatCard key={card.label} label={card.label} value={card.value} hint={card.hint} icon={card.icon} />
            ))}
          </Box>

          <Alert severity="info" icon={<CalendarClock size={16} />}>
            <Typography variant="body2">
              Period: {formatDate(walletQuery.data.period.dateFrom)} to {formatDate(walletQuery.data.period.dateTo)}.
              Data refreshed at {new Date(walletQuery.data.metadata.dataFreshnessTimestamp).toLocaleString("en-US")}
              .
            </Typography>
          </Alert>

          {insights.length > 0 ? (
            <Stack spacing={1}>
              {insights.map((insight) => (
                <Alert key={insight.message} severity={insight.severity}>
                  {insight.message}
                </Alert>
              ))}
            </Stack>
          ) : compare ? (
            <Alert severity="success">No wallet warning flags for the selected period.</Alert>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
