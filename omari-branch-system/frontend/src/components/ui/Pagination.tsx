import { Pagination as MuiPagination, Paper, Stack, Typography } from "@mui/material";

import { glassPanelSx } from "../../app/theme";

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <Paper
      sx={{
        mt: 2,
        px: 2,
        py: 1.4,
        ...glassPanelSx,
      }}
    >
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        gap={1.5}
      >
        <Typography variant="body2" color="text.secondary">
          Showing <strong>{start}</strong>-<strong>{end}</strong> of <strong>{total}</strong>
        </Typography>

        <MuiPagination
          page={Math.min(page, totalPages)}
          count={totalPages}
          onChange={(_event, value) => onPageChange(value)}
          color="primary"
          shape="rounded"
          size="small"
        />
      </Stack>
    </Paper>
  );
}
