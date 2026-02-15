import "./config/env";
import app from "./app";

const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
  console.log(`Health: http://localhost:${port}/health`);
});
