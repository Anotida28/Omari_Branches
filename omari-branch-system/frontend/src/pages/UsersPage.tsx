import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState } from "react";

import { glassPanelSx } from "../app/theme";
import { useAuth } from "../hooks/useAuth";
import { getErrorMessage } from "../services/api";
import {
  createUser,
  fetchUsers,
  ROLE_LABELS,
  updateUser,
  type User,
  type UserRole,
} from "../services/users";

// ─── Role badge ──────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<UserRole, "default" | "primary" | "secondary"> = {
  VIEWER: "default",
  FULL_ACCESS: "primary",
  SUPER_ADMIN: "secondary",
};

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <Chip
      label={ROLE_LABELS[role]}
      color={ROLE_COLORS[role]}
      size="small"
      variant="outlined"
    />
  );
}

// ─── Add User dialog ──────────────────────────────────────────────────────────

function AddUserDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("VIEWER");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createUser({ username: username.trim().toLowerCase(), role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setUsername("");
      setRole("VIEWER");
      setError(null);
      onClose();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  const handleClose = () => {
    if (mutation.isPending) return;
    setUsername("");
    setRole("VIEWER");
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Add User</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            fullWidth
            size="small"
            autoFocus
            helperText="Must match the username in the auth system"
          />
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <MenuItem value="VIEWER">Viewer — read-only access</MenuItem>
              <MenuItem value="FULL_ACCESS">Admin — full read/write access</MenuItem>
              <MenuItem value="SUPER_ADMIN">Super Admin — admin + user management</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!username.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
          startIcon={mutation.isPending ? <CircularProgress size={14} /> : undefined}
        >
          Add User
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── User row ──────────────────────────────────────────────────────────────────

function UserRow({ user, currentUserId }: { user: User; currentUserId: string }) {
  const queryClient = useQueryClient();
  const [editRole, setEditRole] = useState<UserRole | null>(null);
  const isSelf = user.id === currentUserId;

  const roleMutation = useMutation({
    mutationFn: (role: UserRole) => updateUser(user.id, { role }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditRole(null);
    },
  });

  const statusMutation = useMutation({
    mutationFn: (isActive: boolean) => updateUser(user.id, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  const pendingRole = editRole ?? user.role;

  return (
    <TableRow
      sx={{
        opacity: user.isActive ? 1 : 0.5,
        "&:last-child td": { border: 0 },
      }}
    >
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {user.username}
        </Typography>
        {isSelf && (
          <Typography variant="caption" color="text.secondary">
            (you)
          </Typography>
        )}
      </TableCell>

      <TableCell>
        {isSelf ? (
          <RoleBadge role={user.role} />
        ) : (
          <Stack direction="row" alignItems="center" spacing={1}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={pendingRole}
                onChange={(e) => setEditRole(e.target.value as UserRole)}
                disabled={roleMutation.isPending || !user.isActive}
                sx={{ fontSize: 13 }}
              >
                <MenuItem value="VIEWER">Viewer</MenuItem>
                <MenuItem value="FULL_ACCESS">Admin</MenuItem>
                <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
              </Select>
            </FormControl>
            {editRole && editRole !== user.role && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  disabled={roleMutation.isPending}
                  onClick={() => roleMutation.mutate(editRole)}
                >
                  Save
                </Button>
                <Button
                  size="small"
                  disabled={roleMutation.isPending}
                  onClick={() => setEditRole(null)}
                >
                  Cancel
                </Button>
              </>
            )}
          </Stack>
        )}
      </TableCell>

      <TableCell>
        <Tooltip title={isSelf ? "You cannot deactivate yourself" : user.isActive ? "Deactivate" : "Activate"}>
          <span>
            <Switch
              checked={user.isActive}
              disabled={isSelf || statusMutation.isPending}
              size="small"
              onChange={(_, checked) => statusMutation.mutate(checked)}
            />
          </span>
        </Tooltip>
        <Typography variant="caption" color={user.isActive ? "success.main" : "text.disabled"}>
          {user.isActive ? "Active" : "Inactive"}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="caption" color="text.secondary">
          {new Date(user.createdAt).toLocaleDateString()}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const activeCount = data?.filter((u) => u.isActive).length ?? 0;
  const adminCount = data?.filter((u) => u.isActive && u.role !== "VIEWER").length ?? 0;

  return (
    <section className="space-y-5">
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" flexWrap="wrap" gap={2}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            User Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage who can access the system and what they can do.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<UserPlus size={16} />}
          onClick={() => setAddOpen(true)}
        >
          Add User
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, minmax(0,1fr))" },
        }}
      >
        {[
          { label: "Total Users", value: data?.length ?? "—" },
          { label: "Active Users", value: activeCount || "—" },
          { label: "Admins & Super Admins", value: adminCount || "—" },
        ].map((stat) => (
          <Paper key={stat.label} sx={{ p: 2, ...glassPanelSx }}>
            <Typography variant="caption" color="text.secondary">
              {stat.label}
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              {stat.value}
            </Typography>
          </Paper>
        ))}
      </Box>

      <Paper sx={{ ...glassPanelSx }}>
        <Box sx={{ px: 2.5, py: 2 }}>
          <Typography variant="subtitle1" fontWeight={700}>
            All Users
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Role changes take effect on the user's next API request. Inactive users cannot log in.
          </Typography>
        </Box>
        <Divider />

        {isLoading && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {isError && (
          <Box sx={{ p: 3 }}>
            <Alert severity="error">{getErrorMessage(error)}</Alert>
          </Box>
        )}

        {data && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Registered</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {data.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    currentUserId={currentUser?.id ?? ""}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <AddUserDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </section>
  );
}
