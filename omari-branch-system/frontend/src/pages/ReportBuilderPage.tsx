import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  Bell,
  ChartColumn,
  ChevronDown,
  ChevronUp,
  GripVertical,
  LayoutList,
  Mail,
  Send,
  Trash2,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getErrorMessage } from "../services/api";
import {
  fetchMyReportConfig,
  saveMyReportConfig,
  sendTestReport,
  type ReportSection,
  type ReportConfig,
  type SectionType,
} from "../services/custom-report";

// ─── Block Definitions ───────────────────────────────────────────────────────

type BlockDef = {
  label: string;
  description: string;
  icon: LucideIcon;
  defaultParams: Record<string, unknown>;
};

const BLOCK_DEFS: Record<SectionType, BlockDef> = {
  BRANCH_PERFORMANCE: {
    label: "Branch Performance",
    description: "Yesterday's cash in, cash out, e-float and commission per branch",
    icon: ChartColumn,
    defaultParams: { showCashIn: true, showCashOut: true, showEFloat: true, showCommission: true, sortBy: "cashIn", order: "desc" },
  },
  TOP_PERFORMERS: {
    label: "Top Performers",
    description: "Rank branches by a selected metric — top or bottom N",
    icon: Trophy,
    defaultParams: { metric: "cashIn", limit: 10, order: "desc" },
  },
  WALLET_SUMMARY: {
    label: "Wallet Summary",
    description: "Customer counts, total lifetime value and 30-day activity",
    icon: Wallet,
    defaultParams: {},
  },
  WALLET_RETENTION: {
    label: "Wallet Retention",
    description: "Customer activity breakdown: active, inactive 30–60d, dormant 90d+",
    icon: Users,
    defaultParams: {},
  },
  ALERTS_SUMMARY: {
    label: "Alerts Summary",
    description: "Recent expense alerts sent in the last 7 days",
    icon: Bell,
    defaultParams: { limit: 10 },
  },
};

const SECTION_ORDER: SectionType[] = [
  "BRANCH_PERFORMANCE",
  "TOP_PERFORMERS",
  "WALLET_SUMMARY",
  "WALLET_RETENTION",
  "ALERTS_SUMMARY",
];

// ─── Sortable Block Card ──────────────────────────────────────────────────────

type SortableBlockProps = {
  section: ReportSection;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onDelete: () => void;
  onParamChange: (key: string, value: unknown) => void;
};

function SortableBlock({ section, isExpanded, onToggleExpand, onDelete, onParamChange }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const def = BLOCK_DEFS[section.type];
  const Icon = def.icon;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 9 : undefined,
  };

  return (
    <Paper ref={setNodeRef} style={style} variant="outlined" sx={{ mb: 1.5, borderRadius: 2, overflow: "hidden" }}>
      <Stack direction="row" alignItems="center" sx={{ px: 1.5, py: 1.2 }}>
        <Box
          {...attributes}
          {...listeners}
          sx={{ cursor: "grab", color: "text.disabled", mr: 1, display: "flex", alignItems: "center" }}
        >
          <GripVertical size={18} />
        </Box>
        <Box sx={{ color: "primary.main", mr: 1.2, display: "flex" }}>
          <Icon size={17} />
        </Box>
        <Typography sx={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{def.label}</Typography>
        <Tooltip title={isExpanded ? "Collapse" : "Configure"}>
          <IconButton size="small" onClick={onToggleExpand}>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </IconButton>
        </Tooltip>
        <Tooltip title="Remove block">
          <IconButton size="small" onClick={onDelete} sx={{ color: "error.main" }}>
            <Trash2 size={16} />
          </IconButton>
        </Tooltip>
      </Stack>

      {isExpanded && (
        <Box sx={{ px: 2, pb: 2, pt: 0.5, borderTop: "1px solid", borderColor: "divider", bgcolor: "#fafafa" }}>
          <BlockParams section={section} onChange={onParamChange} />
        </Box>
      )}
    </Paper>
  );
}

// ─── Per-block Param Editors ─────────────────────────────────────────────────

function BoolField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <FormControlLabel
      control={<Switch size="small" checked={value} onChange={(e) => onChange(e.target.checked)} />}
      label={<Typography sx={{ fontSize: 13 }}>{label}</Typography>}
      sx={{ ml: 0 }}
    />
  );
}

function BlockParams({ section, onChange }: { section: ReportSection; onChange: (key: string, value: unknown) => void }) {
  const p = section.params;

  if (section.type === "BRANCH_PERFORMANCE") {
    return (
      <Stack spacing={1.5} mt={1}>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "text.secondary" }}>COLUMNS</Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <BoolField label="Cash In" value={p.showCashIn !== false} onChange={(v) => onChange("showCashIn", v)} />
          <BoolField label="Cash Out" value={p.showCashOut !== false} onChange={(v) => onChange("showCashOut", v)} />
          <BoolField label="E-Float" value={p.showEFloat !== false} onChange={(v) => onChange("showEFloat", v)} />
          <BoolField label="Commission" value={p.showCommission !== false} onChange={(v) => onChange("showCommission", v)} />
        </Stack>
        <Stack direction="row" gap={2}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Sort by</InputLabel>
            <Select
              label="Sort by"
              value={(p.sortBy as string) ?? "cashIn"}
              onChange={(e) => onChange("sortBy", e.target.value)}
            >
              <MenuItem value="branchName">Branch Name</MenuItem>
              <MenuItem value="cashIn">Cash In</MenuItem>
              <MenuItem value="cashOut">Cash Out</MenuItem>
              <MenuItem value="eFloat">E-Float</MenuItem>
              <MenuItem value="commission">Commission</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Order</InputLabel>
            <Select label="Order" value={(p.order as string) ?? "desc"} onChange={(e) => onChange("order", e.target.value)}>
              <MenuItem value="desc">High → Low</MenuItem>
              <MenuItem value="asc">Low → High</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>
    );
  }

  if (section.type === "TOP_PERFORMERS") {
    return (
      <Stack direction="row" flexWrap="wrap" gap={2} mt={1}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Metric</InputLabel>
          <Select label="Metric" value={(p.metric as string) ?? "cashIn"} onChange={(e) => onChange("metric", e.target.value)}>
            <MenuItem value="cashIn">Cash In</MenuItem>
            <MenuItem value="cashOut">Cash Out</MenuItem>
            <MenuItem value="eFloat">E-Float Balance</MenuItem>
            <MenuItem value="commission">Commission</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Show</InputLabel>
          <Select label="Show" value={(p.limit as number) ?? 10} onChange={(e) => onChange("limit", Number(e.target.value))}>
            <MenuItem value={5}>Top 5</MenuItem>
            <MenuItem value={10}>Top 10</MenuItem>
            <MenuItem value={20}>Top 20</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Ranking</InputLabel>
          <Select label="Ranking" value={(p.order as string) ?? "desc"} onChange={(e) => onChange("order", e.target.value)}>
            <MenuItem value="desc">Top performers</MenuItem>
            <MenuItem value="asc">Bottom performers</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    );
  }

  if (section.type === "ALERTS_SUMMARY") {
    return (
      <Stack mt={1}>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Max alerts</InputLabel>
          <Select label="Max alerts" value={(p.limit as number) ?? 10} onChange={(e) => onChange("limit", Number(e.target.value))}>
            <MenuItem value={5}>5</MenuItem>
            <MenuItem value={10}>10</MenuItem>
            <MenuItem value={20}>20</MenuItem>
          </Select>
        </FormControl>
      </Stack>
    );
  }

  return (
    <Typography sx={{ fontSize: 13, color: "text.secondary", mt: 1 }}>
      No configurable parameters for this block.
    </Typography>
  );
}

// ─── Branch type (minimal) ───────────────────────────────────────────────────

type Branch = { id: string; city: string; label: string; isActive?: boolean };

// ─── Main Page ───────────────────────────────────────────────────────────────

const EMPTY_CONFIG: ReportConfig = {
  isEnabled: true,
  deliveryEmail: "",
  sections: [],
  branchIds: [],
};

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function ReportBuilderPage() {
  const queryClient = useQueryClient();
  const dndId = useId();
  const [config, setConfig] = useState<ReportConfig>(EMPTY_CONFIG);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" }>({
    open: false, message: "", severity: "success",
  });

  const showToast = (message: string, severity: "success" | "error" = "success") => {
    setToast({ open: true, message, severity });
  };

  const [initialized, setInitialized] = useState(false);

  // Load existing config
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ["my-report-config"],
    queryFn: fetchMyReportConfig,
  });

  useEffect(() => {
    if (!initialized && savedConfig !== undefined) {
      if (savedConfig) setConfig(savedConfig);
      setInitialized(true);
    }
  }, [savedConfig, initialized]);

  // Load branches for filter
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["branches-list"],
    queryFn: async () => {
      const res = await api.get<{ data: Branch[] }>("/api/branches");
      return res.data.data.filter((b: Branch) => b.isActive !== false);
    },
  });

  const saveMutation = useMutation({
    mutationFn: saveMyReportConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-report-config"] });
      showToast("Report saved successfully.");
    },
    onError: (err) => showToast(getErrorMessage(err), "error"),
  });

  const testSendMutation = useMutation({
    mutationFn: sendTestReport,
    onSuccess: (result) => showToast(`Test email sent to ${result.sentTo}`),
    onError: (err) => showToast(getErrorMessage(err), "error"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setConfig((prev) => {
      const oldIdx = prev.sections.findIndex((s) => s.id === active.id);
      const newIdx = prev.sections.findIndex((s) => s.id === over.id);
      return { ...prev, sections: arrayMove(prev.sections, oldIdx, newIdx) };
    });
  }, []);

  const addSection = (type: SectionType) => {
    const alreadyExists = config.sections.some((s) => s.type === type);
    if (alreadyExists) {
      showToast(`${BLOCK_DEFS[type].label} is already in your report.`, "error");
      return;
    }
    const newSection: ReportSection = {
      id: randomId(),
      type,
      params: { ...BLOCK_DEFS[type].defaultParams },
    };
    setConfig((prev) => ({ ...prev, sections: [...prev.sections, newSection] }));
    setExpandedId(newSection.id);
  };

  const removeSection = (id: string) => {
    setConfig((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  };

  const updateParam = (sectionId: string, key: string, value: unknown) => {
    setConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((s) =>
        s.id === sectionId ? { ...s, params: { ...s.params, [key]: value } } : s,
      ),
    }));
  };

  const isBusy = saveMutation.isPending || testSendMutation.isPending;

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1100, mx: "auto" }}>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={3} flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Report Builder</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Build your personalised daily email report. Sent each morning at 08:30.
          </Typography>
        </Box>
        <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={
              <Switch
                checked={config.isEnabled}
                onChange={(e) => setConfig((prev) => ({ ...prev, isEnabled: e.target.checked }))}
              />
            }
            label={
              <Typography sx={{ fontSize: 14, fontWeight: 500 }}>
                {config.isEnabled ? "Daily delivery on" : "Daily delivery off"}
              </Typography>
            }
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<Send size={15} />}
            disabled={isBusy || config.sections.length === 0 || !config.deliveryEmail}
            onClick={() => testSendMutation.mutate()}
          >
            {testSendMutation.isPending ? "Sending…" : "Send test email"}
          </Button>
          <Button
            variant="contained"
            size="small"
            disabled={isBusy || !config.deliveryEmail}
            onClick={() => saveMutation.mutate(config)}
          >
            {saveMutation.isPending ? "Saving…" : "Save report"}
          </Button>
        </Stack>
      </Stack>

      {/* Delivery email */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2 }}>
        <Stack direction="row" alignItems="center" gap={1} mb={1.5}>
          <Mail size={16} />
          <Typography fontWeight={600} fontSize={14}>Delivery Email</Typography>
        </Stack>
        <TextField
          label="Send daily report to"
          type="email"
          size="small"
          fullWidth
          value={config.deliveryEmail}
          onChange={(e) => setConfig((prev) => ({ ...prev, deliveryEmail: e.target.value }))}
          placeholder="your.email@omari.co.zw"
          sx={{ maxWidth: 400 }}
        />
      </Paper>

      {/* Main builder layout */}
      <Stack direction={{ xs: "column", md: "row" }} gap={3} alignItems="flex-start">

        {/* Left: Palette + Branch Filter */}
        <Box sx={{ width: { xs: "100%", md: 280 }, flexShrink: 0 }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
            <Typography fontWeight={700} fontSize={13} color="text.secondary" mb={1.5} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Add Blocks
            </Typography>
            <Stack spacing={1}>
              {SECTION_ORDER.map((type) => {
                const def = BLOCK_DEFS[type];
                const Icon = def.icon;
                const alreadyAdded = config.sections.some((s) => s.type === type);
                return (
                  <Button
                    key={type}
                    fullWidth
                    variant={alreadyAdded ? "outlined" : "contained"}
                    color={alreadyAdded ? "inherit" : "primary"}
                    disabled={alreadyAdded}
                    onClick={() => addSection(type)}
                    startIcon={<Icon size={15} />}
                    sx={{
                      justifyContent: "flex-start",
                      textAlign: "left",
                      fontSize: 13,
                      py: 1,
                      px: 1.5,
                      fontWeight: 600,
                    }}
                  >
                    {def.label}
                  </Button>
                );
              })}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            <Typography fontWeight={700} fontSize={13} color="text.secondary" mb={1} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
              Branch Filter
            </Typography>
            <Typography fontSize={12} color="text.secondary" mb={1.5}>
              Leave blank to include all branches in metric blocks.
            </Typography>
            <FormControl size="small" fullWidth>
              <InputLabel>Branches</InputLabel>
              <Select
                multiple
                value={config.branchIds}
                onChange={(e) => setConfig((prev) => ({ ...prev, branchIds: e.target.value as string[] }))}
                input={<OutlinedInput label="Branches" />}
                renderValue={(selected) => (
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                    {(selected as string[]).map((id) => {
                      const branch = branches.find((b) => b.id === id);
                      return (
                        <Chip
                          key={id}
                          label={branch ? `${branch.city} - ${branch.label}` : id}
                          size="small"
                        />
                      );
                    })}
                  </Box>
                )}
              >
                {branches.map((branch) => (
                  <MenuItem key={branch.id} value={branch.id}>
                    {branch.city} - {branch.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Paper>
        </Box>

        {/* Right: Report Canvas */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" gap={1} mb={2}>
            <LayoutList size={18} />
            <Typography fontWeight={700} fontSize={14}>Your Report</Typography>
            {config.sections.length > 0 && (
              <Chip label={`${config.sections.length} block${config.sections.length !== 1 ? "s" : ""}`} size="small" />
            )}
          </Stack>

          {config.sections.length === 0 ? (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 2,
                p: 5,
                textAlign: "center",
                borderStyle: "dashed",
                color: "text.disabled",
              }}
            >
              <LayoutList size={36} style={{ marginBottom: 12, opacity: 0.4 }} />
              <Typography fontWeight={600} mb={0.5}>No blocks yet</Typography>
              <Typography fontSize={13}>
                Click a block on the left to add it to your report.
              </Typography>
            </Paper>
          ) : (
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={config.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {config.sections.map((section) => (
                  <SortableBlock
                    key={section.id}
                    section={section}
                    isExpanded={expandedId === section.id}
                    onToggleExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
                    onDelete={() => removeSection(section.id)}
                    onParamChange={(key, value) => updateParam(section.id, key, value)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {config.sections.length > 0 && (
            <Typography fontSize={12} color="text.secondary" mt={1.5} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <GripVertical size={13} /> Drag blocks to reorder them in the email.
            </Typography>
          )}
        </Box>
      </Stack>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
