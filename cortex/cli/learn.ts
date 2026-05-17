import { learn } from "../workflows/learn.workflow.js";

learn(process.cwd()).catch((error) => {
  console.error(error);
  process.exit(1);
});
