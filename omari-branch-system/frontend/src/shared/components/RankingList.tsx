import { Box, Chip, List, ListItem, Stack, Typography } from "@mui/material";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

import { formatCurrency } from "../../services/format";

export type RankingItem = {
  branchId: string;
  branchName: string;
  city: string;
  score: number;
  netCashValue: number;
};

type RankingListProps = {
  title: string;
  items: RankingItem[];
  kind: "top" | "bottom";
};

export function RankingList({ title, items, kind }: RankingListProps) {
  const isTop = kind === "top";

  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2.5,
        border: "1px solid rgba(16, 32, 23, 0.1)",
        bgcolor: "rgba(255,255,255,0.72)",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.1 }}>
        <Typography variant="subtitle2" fontWeight={700}>
          {title}
        </Typography>
        <Chip
          size="small"
          color={isTop ? "success" : "warning"}
          icon={isTop ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          label={isTop ? "Top 5" : "Bottom 5"}
        />
      </Stack>

      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No ranking data available.
        </Typography>
      ) : (
        <List disablePadding>
          {items.map((item, index) => (
            <ListItem
              key={item.branchId}
              disableGutters
              sx={{
                py: 0.85,
                borderBottom:
                  index === items.length - 1 ? "none" : "1px solid rgba(16, 32, 23, 0.08)",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ width: "100%" }}
              >
                <Box>
                  <Typography variant="body2" fontWeight={700}>
                    {item.branchName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.city}
                  </Typography>
                </Box>

                <Stack alignItems="flex-end" spacing={0.2}>
                  <Typography variant="body2" fontWeight={700}>
                    {item.score.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatCurrency(item.netCashValue)}
                  </Typography>
                </Stack>
              </Stack>
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
