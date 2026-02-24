import { Alert, AlertTitle } from "@mui/material";

type ErrorStateProps = {
  title?: string;
  message: string;
};

export function ErrorState({ title = "Something went wrong", message }: ErrorStateProps) {
  return (
    <Alert severity="error" variant="outlined">
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  );
}

