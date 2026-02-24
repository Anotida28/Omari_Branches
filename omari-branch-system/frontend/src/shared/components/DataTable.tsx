import { Paper, Table, TableBody, TableContainer, TableHead, type TableProps } from "@mui/material";
import type { ReactNode } from "react";

type DataTableProps = {
  head: ReactNode;
  body: ReactNode;
  paperSx?: TableProps["sx"];
};

export function DataTable({ head, body, paperSx }: DataTableProps) {
  return (
    <Paper
      sx={{
        borderRadius: 3,
        border: "1px solid rgba(16, 32, 23, 0.1)",
        overflow: "hidden",
        backdropFilter: "blur(8px)",
        backgroundColor: "rgba(255,255,255,0.78)",
        ...paperSx,
      }}
    >
      <TableContainer>
        <Table size="small" stickyHeader>
          <TableHead>{head}</TableHead>
          <TableBody>{body}</TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
