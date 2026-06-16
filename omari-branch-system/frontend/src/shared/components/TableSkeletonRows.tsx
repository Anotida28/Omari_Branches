import { Skeleton, TableCell, TableRow } from "@mui/material";

type TableSkeletonRowsProps = {
  columns: number;
  rows?: number;
};

export function TableSkeletonRows({ columns, rows = 5 }: TableSkeletonRowsProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((__, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton variant="text" width={colIndex === 0 ? "80%" : "55%"} />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
