import { Box, Paper, Skeleton, Stack } from "@mui/material";

import { glassPanelSx } from "../../app/theme";

export function StatCardSkeleton() {
  return (
    <Paper
      sx={{
        p: 2.2,
        ...glassPanelSx,
        borderColor: "rgba(22, 82, 55, 0.12)",
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2}>
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={16} />
          <Skeleton variant="text" width="45%" height={32} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="70%" height={16} sx={{ mt: 0.5 }} />
        </Box>
        <Skeleton variant="rounded" width={40} height={40} />
      </Stack>
    </Paper>
  );
}
