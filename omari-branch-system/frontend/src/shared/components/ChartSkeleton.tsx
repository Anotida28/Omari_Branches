import { Paper, Skeleton, Stack } from "@mui/material";

type ChartSkeletonProps = {
  height?: number;
};

export function ChartSkeleton({ height = 280 }: ChartSkeletonProps) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2.2, borderRadius: 3, borderColor: "rgba(16, 32, 23, 0.1)" }}
    >
      <Stack spacing={1}>
        <Skeleton variant="text" width="30%" height={20} />
        <Skeleton variant="rounded" width="100%" height={height} />
      </Stack>
    </Paper>
  );
}
